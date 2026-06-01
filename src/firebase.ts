import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup 
} from 'firebase/auth';
import { getFirestore, doc, getDocFromServer, enableMultiTabIndexedDbPersistence } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// Initialize Auth
export const auth = getAuth(app);

// Enable offline persistence for Firestore
enableMultiTabIndexedDbPersistence(db).catch((err) => {
  if (err.code === 'failed-precondition') {
    console.warn('Firestore persistence failed: multiple tabs open');
  } else if (err.code === 'unimplemented') {
    console.warn('Firestore persistence is not supported by this browser');
  }
});

export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();

// Guard against overlapping auth requests which cause "auth/cancelled-popup-request"
// and "INTERNAL ASSERTION FAILED: Pending promise was never set"
let isSignInInProgress = false;
let signInTimeout: any = null;

export const signInWithGoogle = async () => {
  if (isSignInInProgress) {
    const error = new Error('A sign-in request is already in progress. Please check for an open popup window.');
    (error as any).code = 'auth/request-in-progress';
    throw error;
  }

  isSignInInProgress = true;
  
  // Safety timeout: Reset flag after 60 seconds if it somehow gets stuck
  if (signInTimeout) clearTimeout(signInTimeout);
  signInTimeout = setTimeout(() => {
    isSignInInProgress = false;
  }, 60000);

  try {
    const result = await signInWithPopup(auth, googleProvider);
    if (signInTimeout) {
      clearTimeout(signInTimeout);
      signInTimeout = null;
    }
    isSignInInProgress = false;
    return result;
  } catch (error: any) {
    isSignInInProgress = false;
    if (signInTimeout) {
      clearTimeout(signInTimeout);
      signInTimeout = null;
    }
    if (error.code === 'auth/network-request-failed') {
      console.error('Firebase Auth Network Error: This often happens in iframes or due to browsers blocking third-party cookies/tracking. PLEASE OPEN THE APP IN A NEW TAB TO COMPELTE LOGIN.');
    } else if (error.code === 'auth/popup-blocked') {
      console.error('Firebase Auth Popup Blocked: Please look for a small icon in your address bar to enable popups for this site.');
    } else if (error.code === 'auth/cancelled-popup-request') {
      console.warn('Firebase Auth: Multiple popup requests were made. Only the last one is being processed.');
    } else if (error.message?.includes('INTERNAL ASSERTION FAILED')) {
       console.error('Firebase Auth Internal Error: The authentication state machine got wedged. A page refresh is recommended.');
    }
    throw error;
  }
};

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous
    },
    operationType,
    path
  };
  
  if (errInfo.error.includes('Missing or insufficient permissions')) {
    console.error('🔥 [Access Denied] Firestore Security Rules blocked this action:', JSON.stringify(errInfo, null, 2));
  } else {
    console.error('Firestore Error:', JSON.stringify(errInfo, null, 2));
  }
  
  throw new Error(JSON.stringify(errInfo));
}
