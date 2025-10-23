import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
  type Firestore,
  type Unsubscribe,
} from 'firebase/firestore';
import { getFirestoreDb } from './firebase';
import { logFirebaseEvent } from './logger';

export const USERNAMES = ['Adam', 'Philip', 'Marcus'] as const;
export type Username = (typeof USERNAMES)[number];

const USER_SET = new Set(USERNAMES);
const PENDING_STORAGE_KEY = 'movie-sorting.pendingRatings';
const INITIAL_RETRY_DELAY = 5000;
const MAX_RETRY_DELAY = 60000;

type PendingRating = {
  username: Username;
  movieId: string;
  rating: number;
};

let pendingRatings: PendingRating[] = [];
let hasLoadedPendingRatings = false;
let pendingRetryHandle: ReturnType<typeof setTimeout> | null = null;
let nextRetryDelay = INITIAL_RETRY_DELAY;
let isSyncInitialised = false;
let isProcessingPending = false;

const clampRating = (value: number) => {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(10, Math.max(0, Math.round(value * 10) / 10));
};

function normaliseUsername(rawUsername: string | null | undefined): Username | null {
  if (!rawUsername) return null;
  const trimmed = rawUsername.trim();
  if (USER_SET.has(trimmed as Username)) {
    return trimmed as Username;
  }
  return null;
}

const isBrowserEnvironment = () => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

function ensurePendingRatingsLoaded(): void {
  if (hasLoadedPendingRatings || !isBrowserEnvironment()) {
    return;
  }

  hasLoadedPendingRatings = true;
  try {
    const raw = window.localStorage.getItem(PENDING_STORAGE_KEY);
    if (!raw) {
      pendingRatings = [];
      return;
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      pendingRatings = [];
      return;
    }

    pendingRatings = parsed
      .map((entry) => {
        const username = normaliseUsername(entry?.username);
        const movieId = typeof entry?.movieId === 'string' ? entry.movieId : String(entry?.movieId ?? '');
        const rating = clampRating(typeof entry?.rating === 'number' ? entry.rating : Number.parseFloat(String(entry?.rating ?? 0)));
        if (!username || !movieId) {
          return null;
        }
        return { username, movieId, rating } satisfies PendingRating;
      })
      .filter(Boolean) as PendingRating[];
  } catch {
    pendingRatings = [];
  }
}

function persistPendingRatings(): void {
  if (!isBrowserEnvironment()) {
    return;
  }

  if (!pendingRatings.length) {
    window.localStorage.removeItem(PENDING_STORAGE_KEY);
    nextRetryDelay = INITIAL_RETRY_DELAY;
    return;
  }

  try {
    window.localStorage.setItem(PENDING_STORAGE_KEY, JSON.stringify(pendingRatings));
  } catch {
    // If persistence fails we silently ignore – the next user interaction will try again.
  }
}

function removePendingRating(username: Username, movieId: string): void {
  ensurePendingRatingsLoaded();
  const next = pendingRatings.filter((entry) => !(entry.username === username && entry.movieId === movieId));
  if (next.length !== pendingRatings.length) {
    pendingRatings = next;
    persistPendingRatings();
  }
}

function upsertPendingRating(username: Username, movieId: string, rating: number): void {
  ensurePendingRatingsLoaded();
  const next = pendingRatings.filter((entry) => !(entry.username === username && entry.movieId === movieId));
  next.push({ username, movieId, rating });
  pendingRatings = next;
  persistPendingRatings();
}

function schedulePendingRetry(delay: number = nextRetryDelay): void {
  if (!isBrowserEnvironment()) {
    return;
  }

  if (pendingRetryHandle != null || !pendingRatings.length) {
    return;
  }

  const safeDelay = Math.min(Math.max(delay, INITIAL_RETRY_DELAY), MAX_RETRY_DELAY);
  logFirebaseEvent('Schemalägger synk av väntande betyg', {
    delay: safeDelay,
    pendingCount: pendingRatings.length,
  });
  pendingRetryHandle = window.setTimeout(() => {
    pendingRetryHandle = null;
    void processPendingRatings().then((wasSuccessful) => {
      if (wasSuccessful) {
        nextRetryDelay = INITIAL_RETRY_DELAY;
      } else {
        nextRetryDelay = Math.min(nextRetryDelay * 2, MAX_RETRY_DELAY);
        schedulePendingRetry(nextRetryDelay);
      }
    });
  }, safeDelay);
}

async function writeRating(
  db: Firestore,
  username: Username,
  movieKey: string,
  ratingValue: number
): Promise<void> {
  const reference = doc(db, 'ratings', username, 'movies', movieKey);
  await setDoc(
    reference,
    {
      rating: ratingValue,
      username,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

async function processPendingRatings(): Promise<boolean> {
  ensurePendingRatingsLoaded();
  if (!pendingRatings.length) {
    nextRetryDelay = INITIAL_RETRY_DELAY;
    return true;
  }

  if (isProcessingPending) {
    return false;
  }

  const db = getFirestoreDb();
  if (!db) {
    logFirebaseEvent('Kan inte synka väntande betyg utan Firestore', {
      pendingCount: pendingRatings.length,
    });
    return false;
  }

  isProcessingPending = true;
  logFirebaseEvent('Synkroniserar väntande betyg', { pendingCount: pendingRatings.length });

  try {
    const remaining: PendingRating[] = [];

    for (const entry of pendingRatings) {
      try {
        await writeRating(db, entry.username, entry.movieId, clampRating(entry.rating));
      } catch (error) {
        logFirebaseEvent(
          'Misslyckades att synka väntande betyg',
          {
            entry,
            error: error instanceof Error ? { message: error.message, name: error.name } : error,
          },
          'warn'
        );
        remaining.push(entry);
      }
    }

    pendingRatings = remaining;
    persistPendingRatings();
    const wasSuccessful = remaining.length === 0;
    if (wasSuccessful) {
      nextRetryDelay = INITIAL_RETRY_DELAY;
    }
    logFirebaseEvent('Slutförde synkning av väntande betyg', {
      pendingCount: remaining.length,
      success: wasSuccessful,
    });
    return wasSuccessful;
  } finally {
    isProcessingPending = false;
  }
}

const handleOnline = () => {
  logFirebaseEvent('Anslutning återställd – synkar väntande betyg');
  void processPendingRatings();
};

const handleVisibilityChange = () => {
  if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
    logFirebaseEvent('Fönstret är aktivt – synkar väntande betyg');
    void processPendingRatings();
  }
};

export function initializeRatingSync(): void {
  if (!isBrowserEnvironment()) {
    logFirebaseEvent('Hoppar över rating-synk – ej browsermiljö', undefined, 'warn');
    return;
  }

  ensurePendingRatingsLoaded();

  if (!isSyncInitialised) {
    window.addEventListener('online', handleOnline);
    window.addEventListener('visibilitychange', handleVisibilityChange);
    isSyncInitialised = true;
    logFirebaseEvent('Initierade lyssnare för rating-synk');
  }

  void processPendingRatings().then((wasSuccessful) => {
    if (!wasSuccessful) {
      schedulePendingRetry();
    }
  });
}

function serialiseRatings(entries: Record<string, unknown>): Record<string, number> {
  return Object.entries(entries).reduce<Record<string, number>>((accumulator, [movieId, value]) => {
    const numeric = typeof value === 'number' ? value : Number.parseFloat(String(value));
    if (Number.isFinite(numeric)) {
      accumulator[movieId] = clampRating(numeric);
    }
    return accumulator;
  }, {});
}

export async function saveRating(username: string, movieId: string | number, rating: number): Promise<void> {
  const normalisedUsername = normaliseUsername(username);
  if (!normalisedUsername) {
    logFirebaseEvent(
      'Ogiltigt användarnamn vid sparning av betyg',
      { username },
      'warn'
    );
    return;
  }

  const movieKey = String(movieId);
  const ratingValue = clampRating(rating);
  const db = getFirestoreDb();

  if (!db) {
    logFirebaseEvent(
      'Firestore saknas – lägger betyg i kö',
      { username: normalisedUsername, movieId: movieKey, rating: ratingValue },
      'warn'
    );
    upsertPendingRating(normalisedUsername, movieKey, ratingValue);
    schedulePendingRetry();
    throw new Error('Firestore is not available');
  }

  try {
    logFirebaseEvent('Sparar betyg i Firestore', {
      username: normalisedUsername,
      movieId: movieKey,
      rating: ratingValue,
    });
    await writeRating(db, normalisedUsername, movieKey, ratingValue);
    removePendingRating(normalisedUsername, movieKey);
    if (pendingRatings.length) {
      schedulePendingRetry();
    }
    logFirebaseEvent('Betyg sparades', {
      username: normalisedUsername,
      movieId: movieKey,
      rating: ratingValue,
    });
  } catch (error) {
    upsertPendingRating(normalisedUsername, movieKey, ratingValue);
    schedulePendingRetry();
    logFirebaseEvent(
      'Misslyckades att spara betyg – lade till i kö',
      {
        username: normalisedUsername,
        movieId: movieKey,
        rating: ratingValue,
        error: error instanceof Error ? { message: error.message, name: error.name } : error,
      },
      'error'
    );
    throw error;
  }
}

export async function loadUserRatings(username: string): Promise<Record<string, number>> {
  const db = getFirestoreDb();
  const normalisedUsername = normaliseUsername(username);
  if (!db || !normalisedUsername) {
    logFirebaseEvent(
      'Kan inte läsa betyg utan Firestore eller användare',
      { username },
      'warn'
    );
    return {};
  }

  logFirebaseEvent('Hämtar betyg för användare', { username: normalisedUsername });
  const snapshot = await getDocs(collection(db, 'ratings', normalisedUsername, 'movies'));
  const result: Record<string, number> = {};
  snapshot.forEach((docSnapshot) => {
    const data = docSnapshot.data();
    if (!data) return;
    const numeric = clampRating(typeof data.rating === 'number' ? data.rating : Number.parseFloat(String(data.rating)));
    if (numeric > 0.0001) {
      result[docSnapshot.id] = numeric;
    }
  });
  logFirebaseEvent('Hämtade betyg', { username: normalisedUsername, count: Object.keys(result).length });
  return result;
}

export function subscribeUserRatings(
  username: string,
  callback: (ratings: Record<string, number>) => void
): Unsubscribe {
  const db = getFirestoreDb();
  const normalisedUsername = normaliseUsername(username);
  if (!db || !normalisedUsername) {
    logFirebaseEvent(
      'Kan inte starta prenumeration på betyg',
      { username },
      'warn'
    );
    callback({});
    return () => {};
  }

  const reference = collection(db, 'ratings', normalisedUsername, 'movies');
  logFirebaseEvent('Startar prenumeration på betyg', { username: normalisedUsername });
  return onSnapshot(reference, (snapshot) => {
    const payload: Record<string, number> = {};
    snapshot.forEach((docSnapshot) => {
      const data = docSnapshot.data();
      const numeric = clampRating(
        data && typeof data.rating === 'number' ? data.rating : Number.parseFloat(String(data?.rating ?? '0'))
      );
      if (numeric > 0.0001) {
        payload[docSnapshot.id] = numeric;
      }
    });
    logFirebaseEvent('Mottog uppdaterade betyg', {
      username: normalisedUsername,
      count: snapshot.size,
    });
    callback(payload);
  });
}

export async function loadAllRatings(): Promise<Record<Username, Record<string, number>>> {
  logFirebaseEvent('Hämtar samtliga betyg för alla användare');
  const entries = await Promise.all(
    USERNAMES.map(async (username) => {
      const ratings = await loadUserRatings(username);
      return [username, ratings] as const;
    })
  );

  const result = entries.reduce<Record<Username, Record<string, number>>>((accumulator, [username, ratings]) => {
    accumulator[username] = serialiseRatings(ratings);
    return accumulator;
  }, {} as Record<Username, Record<string, number>>);

  logFirebaseEvent('Samtliga betyg hämtade', {
    userCount: USERNAMES.length,
    totalRatings: Object.values(result).reduce((sum, userRatings) => sum + Object.keys(userRatings).length, 0),
  });

  return result;
}
