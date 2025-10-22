import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  enableIndexedDbPersistence,
  getFirestore,
  type Firestore,
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const isConfigValid = Object.values(firebaseConfig).some((value) => Boolean(value));

let appInstance: FirebaseApp | null = null;
let firestoreInstance: Firestore | null = null;
let persistenceAttempted = false;

function ensureApp(): FirebaseApp | null {
  if (!isConfigValid) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.warn('Firebase configuration is missing. Firestore features are disabled.');
    }
    return null;
  }

  if (!appInstance) {
    appInstance = initializeApp(firebaseConfig);
  }
  return appInstance;
}

export function getFirestoreDb(): Firestore | null {
  const app = ensureApp();
  if (!app) {
    return null;
  }

  if (!firestoreInstance) {
    firestoreInstance = getFirestore(app);
  }

  if (!persistenceAttempted && firestoreInstance) {
    persistenceAttempted = true;
    if (typeof window !== 'undefined') {
      enableIndexedDbPersistence(firestoreInstance).catch((error) => {
        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.warn('IndexedDB persistence could not be enabled', error);
        }
      });
    }
  }

  return firestoreInstance;
}

export const isFirestoreAvailable = () => getFirestoreDb() !== null;
