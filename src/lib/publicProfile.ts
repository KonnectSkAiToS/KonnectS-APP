import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

/**
 * Mirrors the safe, shareable part of a worker's profile to /public_profiles/{uid} so the worker
 * directory never has to list /users (which holds email, phone, DOB and documents).
 * Trust fields (rating, reviewCount, verificationStatus, ...) are copied from the user's own document and the
 * Firestore rules reject the write if they differ from the real values.
 */
const PUBLIC_KEYS = [
  'username', 'fullName', 'avatarUrl', 'workerType', 'skills', 'hourlyRate', 'availabilityStatus',
  'bio', 'location', 'isWorker', 'rating', 'reviewCount', 'verificationStatus', 'isPremiumWorker', 'featured'
] as const;

const lastMirrored = new Map<string, string>();

export async function ensurePublicProfile(profile: Record<string, any> | null | undefined) {
  if (!profile?.uid || profile.uid === 'guest-user' || profile.isWorker !== true) return;

  const data: Record<string, any> = { uid: profile.uid };
  for (const key of PUBLIC_KEYS) {
    if (profile[key] !== undefined && profile[key] !== null) data[key] = profile[key];
  }

  const signature = JSON.stringify(data);
  if (lastMirrored.get(profile.uid) === signature) return; // nothing changed

  try {
    await setDoc(doc(db, 'public_profiles', profile.uid), { ...data, updatedAt: serverTimestamp() });
    lastMirrored.set(profile.uid, signature);
  } catch (err) {
    console.warn('[publicProfile] Could not publish worker profile:', err);
  }
}
