import { initializeApp, type FirebaseApp, type FirebaseOptions } from 'firebase/app';
import {
  enableIndexedDbPersistence,
  getFirestore,
  type Firestore,
} from 'firebase/firestore';

const firebaseEnvConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
} as const;

const sanitisedFirebaseConfig: Partial<FirebaseOptions> = Object.fromEntries(
  Object.entries(firebaseEnvConfig).map(([key, value]) => [
    key,
    typeof value === 'string' ? value.trim() : value,
  ])
) as Partial<FirebaseOptions>;

const isConfigValid = Object.values(sanitisedFirebaseConfig).every(
  (value) => typeof value === 'string' && value.length > 0,
);

const firebaseConfig: FirebaseOptions | null = isConfigValid
  ? (sanitisedFirebaseConfig as FirebaseOptions)
  : null;

let appInstance: FirebaseApp | null = null;
let firestoreInstance: Firestore | null = null;
let persistenceAttempted = false;

function ensureApp(): FirebaseApp | null {
  if (!firebaseConfig) {
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
