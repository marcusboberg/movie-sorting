import { initializeApp, type FirebaseApp, type FirebaseOptions } from 'firebase/app';
import { enableIndexedDbPersistence, getFirestore, type Firestore } from 'firebase/firestore';
import { logFirebaseEvent } from './logger';

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

const missingConfigKeys = Object.entries(firebaseEnvConfig)
  .filter(([, value]) => typeof value !== 'string' || value.trim().length === 0)
  .map(([key]) => key);

if (firebaseConfig) {
  logFirebaseEvent('Firebase-konfiguration laddades', {
    providedKeys: Object.keys(firebaseConfig),
  });
} else {
  logFirebaseEvent(
    'Firebase-konfigurationen är ofullständig',
    { missingKeys: missingConfigKeys },
    'warn'
  );
}

let appInstance: FirebaseApp | null = null;
let firestoreInstance: Firestore | null = null;
let persistenceAttempted = false;
let hasLoggedMissingConfigWarning = false;
let hasLoggedAppInitialisation = false;
let hasLoggedFirestoreInitialisation = false;
let hasLoggedPersistenceAttempt = false;

function ensureApp(): FirebaseApp | null {
  if (!firebaseConfig) {
    if (!hasLoggedMissingConfigWarning) {
      logFirebaseEvent(
        'Försökte initiera utan Firebase-konfiguration',
        { missingKeys: missingConfigKeys },
        'warn'
      );
      hasLoggedMissingConfigWarning = true;
    }
    return null;
  }

  if (!appInstance) {
    appInstance = initializeApp(firebaseConfig);
    if (!hasLoggedAppInitialisation) {
      logFirebaseEvent('Firebase-appen initialiserades');
      hasLoggedAppInitialisation = true;
    }
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
    if (!hasLoggedFirestoreInitialisation) {
      logFirebaseEvent('Firestore-instansen skapades');
      hasLoggedFirestoreInitialisation = true;
    }
  }

  if (!persistenceAttempted && firestoreInstance) {
    persistenceAttempted = true;
    if (typeof window !== 'undefined') {
      if (!hasLoggedPersistenceAttempt) {
        logFirebaseEvent('Försöker aktivera IndexedDB-persistens');
        hasLoggedPersistenceAttempt = true;
      }
      enableIndexedDbPersistence(firestoreInstance)
        .then(() => {
          logFirebaseEvent('IndexedDB-persistens aktiverad');
        })
        .catch((error: unknown) => {
          const payload =
            error instanceof Error
              ? { message: error.message, name: error.name }
              : { error };
          logFirebaseEvent('IndexedDB-persistens kunde inte aktiveras', payload, 'warn');
        });
    } else if (!hasLoggedPersistenceAttempt) {
      logFirebaseEvent('Hoppar över IndexedDB-persistens i icke-browsermiljö', undefined, 'warn');
      hasLoggedPersistenceAttempt = true;
    }
  }

  return firestoreInstance;
}

export const isFirestoreAvailable = () => getFirestoreDb() !== null;
