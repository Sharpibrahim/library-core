// Local Database using native IndexedDB for offline authentication, voice notes, and sync queuing.

const DB_NAME = 'library_core_local_db';
const DB_VERSION = 1;

export interface OfflineUser {
  uid: string;
  username: string;
  email?: string;
  fullName: string;
  role: 'student' | 'teacher' | 'admin';
  class: string | null;
  passwordHash?: string; // SHA-256 of password
  isGoogle: boolean;
  contactCode: string;
}

export interface OfflineVoiceNote {
  id: string; // msg ID
  blob: Blob;
  peaks: number[];
  duration: number;
}

export interface SyncAction {
  id?: number;
  type: 'create_message' | 'delete_message' | 'create_resource' | 'update_settings' | 'upload_file';
  collection: string;
  docId?: string;
  data: any;
  blob?: Blob; // for audio/file uploads
}

export interface OfflineMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  content: string; // base64 or text content
  timestamp: any; // { seconds, nanoseconds }
  type: 'text' | 'file' | 'audio';
  localAudioUrl?: string; // transient blob URL
  duration?: number;
}

class LocalDB {
  private db: IDBDatabase | null = null;
  private dbPromise: Promise<IDBDatabase> | null = null;

  constructor() {
    this.init();
  }

  private init(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event: any) => {
        const db = event.target.result;

        // Users store for offline credentials
        if (!db.objectStoreNames.contains('users')) {
          db.createObjectStore('users', { keyPath: 'uid' });
        }

        // Voice Notes binary store
        if (!db.objectStoreNames.contains('voice_notes')) {
          db.createObjectStore('voice_notes', { keyPath: 'id' });
        }

        // Sync queue for offline actions
        if (!db.objectStoreNames.contains('sync_queue')) {
          db.createObjectStore('sync_queue', { keyPath: 'id', autoIncrement: true });
        }

        // Messages local cache
        if (!db.objectStoreNames.contains('messages')) {
          const msgStore = db.createObjectStore('messages', { keyPath: 'id' });
          msgStore.createIndex('conversationId', 'conversationId', { unique: false });
        }
      };

      request.onsuccess = (event: any) => {
        this.db = event.target.result;
        resolve(this.db!);
      };

      request.onerror = (event: any) => {
        console.error('IndexedDB open error:', event.target.error);
        reject(event.target.error);
      };
    });

    return this.dbPromise;
  }

  private async getStore(
    storeName: 'users' | 'voice_notes' | 'sync_queue' | 'messages',
    mode: IDBTransactionMode = 'readonly'
  ): Promise<IDBObjectStore> {
    const db = await this.init();
    const transaction = db.transaction(storeName, mode);
    return transaction.objectStore(storeName);
  }

  // Cryptographic hashing for credentials encryption
  private async hashPassword(password: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(password + 'library_salt_2026');
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  // --- Offline Users / Authenticaton ---
  public async getAllOfflineUsers(): Promise<OfflineUser[]> {
    const store = await this.getStore('users', 'readonly');
    return new Promise((resolve) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  }

  public async saveOfflineUser(user: OfflineUser, password?: string): Promise<void> {
    const store = await this.getStore('users', 'readwrite');
    const saveData: OfflineUser = { ...user };
    if (password) {
      saveData.passwordHash = await this.hashPassword(password);
    }
    return new Promise((resolve, reject) => {
      const req = store.put(saveData);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  public async getOfflineUserByEmail(email: string): Promise<OfflineUser | null> {
    const store = await this.getStore('users', 'readonly');
    return new Promise((resolve) => {
      // Find user by scanning users (or we can use indexing, but since user count is small, manual is simple)
      const req = store.openCursor();
      req.onsuccess = (event: any) => {
        const cursor = event.target.result;
        if (cursor) {
          const user = cursor.value as OfflineUser;
          if (user.email === email || user.username === email) {
            resolve(user);
            return;
          }
          cursor.continue();
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  }

  public async getOfflineUser(uid: string): Promise<OfflineUser | null> {
    const store = await this.getStore('users', 'readonly');
    return new Promise((resolve) => {
      const req = store.get(uid);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  }

  public async verifyOfflineCredentials(emailOrUsername: string, password?: string, isGoogle: boolean = false): Promise<OfflineUser | null> {
    const user = await this.getOfflineUserByEmail(emailOrUsername);
    if (!user) return null;

    if (isGoogle && user.isGoogle) {
      return user;
    }

    if (!isGoogle && password && user.passwordHash) {
      const hash = await this.hashPassword(password);
      if (user.passwordHash === hash) {
        return user;
      }
    }

    return null;
  }

  // --- Offline Messages Storage ---
  public async saveLocalMessage(msg: OfflineMessage): Promise<void> {
    const store = await this.getStore('messages', 'readwrite');
    return new Promise((resolve, reject) => {
      const req = store.put(msg);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  public async deleteLocalMessage(id: string): Promise<void> {
    const store = await this.getStore('messages', 'readwrite');
    return new Promise((resolve, reject) => {
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  public async getLocalMessagesForConversation(convId: string): Promise<OfflineMessage[]> {
    const store = await this.getStore('messages', 'readonly');
    const index = store.index('conversationId');
    return new Promise((resolve) => {
      const req = index.getAll(convId);
      req.onsuccess = () => {
        resolve(req.result || []);
      };
      req.onerror = () => resolve([]);
    });
  }

  // --- Voice Notes (Binary & Waves) ---
  public async saveVoiceNote(voice: OfflineVoiceNote): Promise<void> {
    const store = await this.getStore('voice_notes', 'readwrite');
    return new Promise((resolve, reject) => {
      const req = store.put(voice);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  public async getVoiceNote(id: string): Promise<OfflineVoiceNote | null> {
    const store = await this.getStore('voice_notes', 'readonly');
    return new Promise((resolve) => {
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  }

  // --- Offline Synchronization Queue ---
  public async queueSyncAction(action: SyncAction): Promise<number> {
    const store = await this.getStore('sync_queue', 'readwrite');
    return new Promise((resolve, reject) => {
      const req = store.add(action);
      req.onsuccess = () => resolve(req.result as number);
      req.onerror = () => reject(req.error);
    });
  }

  public async getSyncQueue(): Promise<SyncAction[]> {
    const store = await this.getStore('sync_queue', 'readonly');
    return new Promise((resolve) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  }

  public async removeSyncAction(id: number): Promise<void> {
    const store = await this.getStore('sync_queue', 'readwrite');
    return new Promise((resolve, reject) => {
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  public async clearSyncQueue(): Promise<void> {
    const store = await this.getStore('sync_queue', 'readwrite');
    return new Promise((resolve) => {
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    });
  }
}

export const localDB = new LocalDB();
