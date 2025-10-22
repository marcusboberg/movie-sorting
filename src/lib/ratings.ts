import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
  type Unsubscribe,
} from 'firebase/firestore';
import { getFirestoreDb } from './firebase';

export const USERNAMES = ['Adam', 'Philip', 'Marcus'] as const;
export type Username = (typeof USERNAMES)[number];

const USER_SET = new Set(USERNAMES);

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
  const db = getFirestoreDb();
  const normalisedUsername = normaliseUsername(username);
  if (!db || !normalisedUsername) {
    return;
  }

  const movieKey = String(movieId);
  const ratingValue = clampRating(rating);
  const reference = doc(db, 'ratings', normalisedUsername, 'movies', movieKey);
  await setDoc(
    reference,
    {
      rating: ratingValue,
      username: normalisedUsername,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function loadUserRatings(username: string): Promise<Record<string, number>> {
  const db = getFirestoreDb();
  const normalisedUsername = normaliseUsername(username);
  if (!db || !normalisedUsername) {
    return {};
  }

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
  return result;
}

export function subscribeUserRatings(
  username: string,
  callback: (ratings: Record<string, number>) => void
): Unsubscribe {
  const db = getFirestoreDb();
  const normalisedUsername = normaliseUsername(username);
  if (!db || !normalisedUsername) {
    callback({});
    return () => {};
  }

  const reference = collection(db, 'ratings', normalisedUsername, 'movies');
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
    callback(payload);
  });
}

export async function loadAllRatings(): Promise<Record<Username, Record<string, number>>> {
  const entries = await Promise.all(
    USERNAMES.map(async (username) => {
      const ratings = await loadUserRatings(username);
      return [username, ratings] as const;
    })
  );

  return entries.reduce<Record<Username, Record<string, number>>>((accumulator, [username, ratings]) => {
    accumulator[username] = serialiseRatings(ratings);
    return accumulator;
  }, {} as Record<Username, Record<string, number>>);
}
