import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';

/**
 * Lets the login screen resolve a username or mobile number to an email with a single
 * document `get` on /login_index/{key} (listing/scraping is blocked by the security rules),
 * instead of querying the whole /users collection as an unauthenticated visitor.
 */
export const normalizeUsername = (v: string) => v.trim().toLowerCase();
export const normalizeMobile = (v: string) => v.replace(/[^0-9]/g, '');
export const usernameKey = (v: string) => 'u_' + encodeURIComponent(normalizeUsername(v));
export const mobileKey = (v: string) => 'm_' + normalizeMobile(v);

export async function lookupLoginIndex(key: string): Promise<{ email: string; username?: string; uid?: string } | null> {
  try {
    const snap = await getDoc(doc(db, 'login_index', key));
    if (snap.exists() && typeof snap.data().email === 'string') return snap.data() as any;
  } catch (err) {
    console.warn('[loginIndex] lookup failed:', err);
  }
  return null;
}

/** Resolve an email / username / mobile number to the email used to sign in. */
export async function resolveLoginIdentifier(identifier: string): Promise<string | null> {
  const id = identifier.trim();
  if (!id) return null;
  if (id.includes('@')) return id.toLowerCase();

  const byUsername = await lookupLoginIndex(usernameKey(id));
  if (byUsername) return byUsername.email;

  if (normalizeMobile(id).length >= 7) {
    const byMobile = await lookupLoginIndex(mobileKey(id));
    if (byMobile) return byMobile.email;
  }
  return null;
}

/** Best-effort: publish this signed-in user's username/mobile -> email mapping. */
export async function ensureLoginIndex(profile: { uid: string; email?: string; username?: string; mobileNumber?: string }) {
  if (!profile?.uid || !profile.email || profile.uid === 'guest-user') return;
  const entry = { uid: profile.uid, email: profile.email, username: profile.username || '' };
  const keys: string[] = [];
  if (profile.username && profile.username.trim()) keys.push(usernameKey(profile.username));
  if (profile.mobileNumber && normalizeMobile(profile.mobileNumber).length >= 7) keys.push(mobileKey(profile.mobileNumber));

  for (const key of keys) {
    try {
      await setDoc(doc(db, 'login_index', key), entry);
    } catch {
      // Key already owned by someone else, or offline. Not fatal.
    }
  }
}
