import { 
  collection, 
  addDoc, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import { localDB, SyncAction, OfflineMessage, OfflineVoiceNote } from './localDb';

// Subscribe-able network status helper
export class SyncService {
  private static listeners: Set<(online: boolean) => void> = new Set();
  private static isSyncing = false;

  public static initialize() {
    window.addEventListener('online', () => {
      console.log('[Sync] Device is ONLINE. Triggering synchronization...');
      this.notifyListeners(true);
      this.syncPendingActions().catch(err => {
        console.error('[Sync] Error during background synchronization:', err);
      });
    });

    window.addEventListener('offline', () => {
      console.log('[Sync] Device is OFFLINE.');
      this.notifyListeners(false);
    });

    // Also listen to Service Worker messaging
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'TRIGGER_BACKGROUND_SYNC') {
          console.log('[Sync] SW requested background synchronization...');
          this.syncPendingActions().catch(err => {
            console.error('[Sync] SW Sync failed:', err);
          });
        }
      });
    }

    // Auto-attempt sync on bootstrap if online
    if (navigator.onLine) {
      setTimeout(() => this.syncPendingActions(), 3000);
    }
  }

  public static getOnlineStatus(): boolean {
    return navigator.onLine;
  }

  public static subscribe(listener: (online: boolean) => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private static notifyListeners(online: boolean) {
    this.listeners.forEach(listener => listener(online));
  }

  // --- Voice Message Generator for peaks ---
  public static generateWaveformPeaks(durationSeconds: number = 5): number[] {
    const barCount = 18;
    const peaks: number[] = [];
    for (let i = 0; i < barCount; i++) {
      peaks.push(Math.round(Math.random() * 20 + 5)); // peak heights
    }
    return peaks;
  }

  // --- Messages pipeline (WhatsApp style voice messages) ---
  public static async sendVoiceMessage(
    conversationId: string,
    senderId: string,
    senderName: string,
    audioBlob: Blob,
    durationSeconds: number
  ): Promise<string> {
    const tempMsgId = 'msg_' + Date.now() + '_' + Math.round(Math.random() * 100000);
    const peaks = this.generateWaveformPeaks(durationSeconds);

    // 1. Cache the audio file locally as a Blob in IndexedDB permanently!
    await localDB.saveVoiceNote({
      id: tempMsgId,
      blob: audioBlob,
      peaks,
      duration: durationSeconds
    });

    const localUrl = URL.createObjectURL(audioBlob);

    // 2. Display instantly in the chat UI
    const offlineMessage: OfflineMessage = {
      id: tempMsgId,
      conversationId,
      senderId,
      senderName,
      content: localUrl, // Use local blob url for immediate instant playback
      timestamp: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 },
      type: 'audio',
      localAudioUrl: localUrl,
      duration: durationSeconds
    };
    await localDB.saveLocalMessage(offlineMessage);

    // 3. Queue or upload depending on network status
    if (this.getOnlineStatus()) {
      try {
        console.log('[Sync] Uploading voice note to Cloud Storage...', tempMsgId);
        const storagePath = `voice_notes/${senderId}/${tempMsgId}.webm`;
        const storageRef = ref(storage, storagePath);
        
        await uploadBytes(storageRef, audioBlob);
        const cloudUrl = await getDownloadURL(storageRef);
        console.log('[Sync] Voice Note Cloud URL:', cloudUrl);

        // Save immediately to Firestore
        const msgRef = doc(db, 'conversations', conversationId, 'messages', tempMsgId);
        await setDoc(msgRef, {
          senderId,
          senderName,
          content: cloudUrl,
          timestamp: serverTimestamp(),
          type: 'audio',
          peaks,
          duration: durationSeconds
        });

        // Update conversation summary
        const convRef = doc(db, 'conversations', conversationId);
        await updateDoc(convRef, {
          lastMessage: '🎙️ Voice Note',
          lastMessageTimestamp: serverTimestamp(),
          lastMessageSenderId: senderId
        });

        // Update local message cache to reference the actual cloud URL
        offlineMessage.content = cloudUrl;
        await localDB.saveLocalMessage(offlineMessage);

      } catch (err) {
        console.warn('[Sync] Online upload failed, queueing as offline action:', err);
        await localDB.queueSyncAction({
          type: 'create_message',
          collection: `conversations/${conversationId}/messages`,
          docId: tempMsgId,
          data: {
            senderId,
            senderName,
            conversationId,
            type: 'audio',
            peaks,
            duration: durationSeconds
          },
          blob: audioBlob
        });
      }
    } else {
      console.log('[Sync] Offline: Queued voice note message for sync', tempMsgId);
      await localDB.queueSyncAction({
        type: 'create_message',
        collection: `conversations/${conversationId}/messages`,
        docId: tempMsgId,
        data: {
          senderId,
          senderName,
          conversationId,
          type: 'audio',
          peaks,
          duration: durationSeconds
        },
        blob: audioBlob
      });
    }

    return tempMsgId;
  }

  // --- Text Messages pipeline ---
  public static async sendTextMessage(
    conversationId: string,
    senderId: string,
    senderName: string,
    content: string
  ): Promise<string> {
    const tempMsgId = 'msg_' + Date.now() + '_' + Math.round(Math.random() * 100000);

    // Save locally
    const offlineMessage: OfflineMessage = {
      id: tempMsgId,
      conversationId,
      senderId,
      senderName,
      content,
      timestamp: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 },
      type: 'text'
    };
    await localDB.saveLocalMessage(offlineMessage);

    if (this.getOnlineStatus()) {
      try {
        const msgRef = doc(db, 'conversations', conversationId, 'messages', tempMsgId);
        await setDoc(msgRef, {
          senderId,
          senderName,
          content,
          timestamp: serverTimestamp(),
          type: 'text'
        });

        // Update conversation summary
        const convRef = doc(db, 'conversations', conversationId);
        await updateDoc(convRef, {
          lastMessage: content,
          lastMessageTimestamp: serverTimestamp(),
          lastMessageSenderId: senderId
        });
      } catch (err) {
        console.warn('[Sync] Sending message online failed. Queueing offline:', err);
        await localDB.queueSyncAction({
          type: 'create_message',
          collection: `conversations/${conversationId}/messages`,
          docId: tempMsgId,
          data: {
            senderId,
            senderName,
            content,
            conversationId,
            type: 'text'
          }
        });
      }
    } else {
      console.log('[Sync] Offline: Queued text message for sync', tempMsgId);
      await localDB.queueSyncAction({
        type: 'create_message',
        collection: `conversations/${conversationId}/messages`,
        docId: tempMsgId,
        data: {
          senderId,
          senderName,
          content,
          conversationId,
          type: 'text'
        }
      });
    }

    return tempMsgId;
  }

  // --- Resource (Upload Content) upload queuing ---
  public static async queueResourceUpload(
    resourceData: any,
    file?: File
  ): Promise<void> {
    if (this.getOnlineStatus() && file) {
      // Standard upload directly
      try {
        const fileExtension = file.name.split('.').pop();
        const storagePath = `resources/${resourceData.uploadedBy}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
        const storageRef = ref(storage, storagePath);
        
        await uploadBytes(storageRef, file);
        const cloudUrl = await getDownloadURL(storageRef);

        await addDoc(collection(db, 'resources'), {
          ...resourceData,
          fileUrl: cloudUrl,
          createdAt: new Date().toISOString(),
          timestamp: serverTimestamp()
        });
        return;
      } catch (err) {
        console.error('[Sync] Direct upload failed, carrying over offline queuing:', err);
      }
    }

    // Offline queuing behavior
    console.log('[Sync] Offline resource queued successfully.');
    await localDB.queueSyncAction({
      type: 'create_resource',
      collection: 'resources',
      data: {
        ...resourceData,
        title: resourceData.title,
        author: resourceData.author,
        type: resourceData.type || 'pdf',
        description: resourceData.description,
        status: 'available',
        genre: resourceData.genre,
        className: resourceData.className,
        subject: resourceData.subject,
        uploadedBy: resourceData.uploadedBy,
        createdAt: new Date().toISOString()
      },
      blob: file ? file : undefined
    });
  }

  // --- Background sync runner (online auto-sync trigger) ---
  public static async syncPendingActions(): Promise<void> {
    if (this.isSyncing) return;
    if (!this.getOnlineStatus()) return;

    const queue = await localDB.getSyncQueue();
    if (queue.length === 0) return;

    this.isSyncing = true;
    console.log(`[Sync] Beginning sync pipeline. Pending actions: ${queue.length}`);

    for (const action of queue) {
      try {
        if (action.type === 'create_message') {
          let finalContent = action.data.content;

          // If the message is a voice message, we must upload the cached Blob to cloud first!
          if (action.data.type === 'audio' && action.blob && action.docId) {
            console.log('[Sync] Background sync: Uploading offline voice note file...');
            const storagePath = `voice_notes/${action.data.senderId}/${action.docId}.webm`;
            const storageRef = ref(storage, storagePath);

            await uploadBytes(storageRef, action.blob);
            finalContent = await getDownloadURL(storageRef);
            console.log('[Sync] Voice Note synced:', finalContent);
          }

          // Write message to Firestore
          const msgRef = doc(db, action.collection, action.docId!);
          await setDoc(msgRef, {
            senderId: action.data.senderId,
            senderName: action.data.senderName,
            content: finalContent,
            timestamp: serverTimestamp(),
            type: action.data.type,
            peaks: action.data.peaks || null,
            duration: action.data.duration || null
          });

          // Update conversation summary
          const convRef = doc(db, 'conversations', action.data.conversationId);
          await updateDoc(convRef, {
            lastMessage: action.data.type === 'audio' ? '🎙️ Voice Note' : finalContent,
            lastMessageTimestamp: serverTimestamp(),
            lastMessageSenderId: action.data.senderId
          });

          // Sync local messages cache block
          const localCached = await localDB.getVoiceNote(action.docId!);
          await localDB.saveLocalMessage({
            id: action.docId!,
            conversationId: action.data.conversationId,
            senderId: action.data.senderId,
            senderName: action.data.senderName,
            content: finalContent,
            timestamp: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 },
            type: action.data.type,
            localAudioUrl: localCached ? URL.createObjectURL(localCached.blob) : undefined,
            duration: action.data.duration
          });
        } 
        
        else if (action.type === 'create_resource') {
          let fileUrl = action.data.fileUrl;

          // If there is an offline file Blob, upload it to permanent storage in background
          if (action.blob) {
            console.log('[Sync] Background sync: Uploading offline document file to permanent storage...');
            const fileName = (action.blob as any).name || 'offline_document.pdf';
            try {
              const storagePath = `resources/${action.data.uploadedBy}/${Date.now()}_${fileName.replace(/[^a-zA-Z0-9.]/g, '_')}`;
              const storageRef = ref(storage, storagePath);
              await uploadBytes(storageRef, action.blob);
              fileUrl = await getDownloadURL(storageRef);
              console.log('[Sync] Background sync: Firebase Storage upload successful:', fileUrl);
            } catch (err) {
              console.error('[Sync] Background sync: Firebase Storage upload failed:', err);
            }
          }

          // Save returned cloud URL to database
          await addDoc(collection(db, action.collection), {
            ...action.data,
            fileUrl,
            timestamp: serverTimestamp()
          });

          // Also save in SQLite on the server
          const syncFormData = new FormData();
          syncFormData.append('title', action.data.title);
          syncFormData.append('author', action.data.author);
          syncFormData.append('type', action.data.type);
          syncFormData.append('description', action.data.description || '');
          syncFormData.append('cover_url', action.data.coverUrl || '');
          syncFormData.append('genre', action.data.genre || 'book');
          syncFormData.append('body_file_url', fileUrl);

          try {
            await fetch('/api/resources', {
              method: 'POST',
              body: syncFormData
            });
            console.log('[Sync] SQLite sync in background successful.');
          } catch (sqliteErr) {
            console.error('[Sync] SQLite sync in background failed:', sqliteErr);
          }
        }

        // Successfully synced! Delete from queue
        await localDB.removeSyncAction(action.id!);
        console.log(`[Sync] Action successfully synchronized and removed in background. ID: ${action.id}`);

      } catch (err) {
        console.error('[Sync] Error synchronizing action:', action, err);
        // Keep in queue for next attempt
      }
    }

    this.isSyncing = false;
    console.log('[Sync] Sync pipeline run completed.');
  }
}
