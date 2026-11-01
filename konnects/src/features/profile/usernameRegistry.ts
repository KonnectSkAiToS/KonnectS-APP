import { collection, doc, getDoc, getDocs, limit, query, runTransaction, setDoc, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { normalizeUsername } from './validation';

/**
 * Username uniqueness.
 *
 * Firestore cannot enforce a unique field, and signed-in users are not allowed to scan the whole
 * `users` collection. So every username is registered as one document in `login_index`
 * (key `u_<lowercase username>`), and a change is a transaction: claim the new key, release the old one.
 * Two people can never hold the same key, and the security rules only let you write your own entry.
 */
export class UsernameTakenError extends Error {
  constructor(name: string) {
    super(`Username "${name}" is already taken.`);
    this.name = 'UsernameTakenError';
  }
}

export const usernameKey = (name: string) => 'u_' + encodeURIComponent(normalizeUsername(name).toLowerCase());

export async function isUsernameAvailable(name: string, uid: string): Promise<boolean> {
  const clean = normalizeUsername(name);

  // 1) The registry is authoritative for every username claimed through it.
  const entry = await getDoc(doc(db, 'login_index', usernameKey(clean)));
  if (entry.exists() && entry.data().uid !== uid) return false;

  // 2) Accounts created before the registry existed have not claimed their name yet. Where the
  //    security rules allow it, also look for them in the users collection (ignored when not permitted).
  try {
    for (const candidate of new Set([clean, clean.toLowerCase()])) {
      const snap = await getDocs(query(collection(db, 'users'), where('username', '==', candidate), limit(2)));
      if (snap.docs.some((d) => d.id !== uid)) return false;
    }
  } catch {
    /* listing users is not permitted under the hardened rules; the registry check above still applies */
  }
  return true;
}

/** Atomically claim `newUsername` and release `oldUsername`. Throws UsernameTakenError if someone else has it. */
export async function changeUsername(args: { uid: string; email: string; oldUsername?: string; newUsername: string }) {
  const { uid, email, oldUsername, newUsername } = args;
  const newName = normalizeUsername(newUsername);
  const newRef = doc(db, 'login_index', usernameKey(newName));
  const oldRef = oldUsername ? doc(db, 'login_index', usernameKey(oldUsername)) : null;

  await runTransaction(db, async (tx) => {
    const newSnap = await tx.get(newRef);
    const oldSnap = oldRef && oldRef.path !== newRef.path ? await tx.get(oldRef) : null;

    if (newSnap.exists() && newSnap.data().uid !== uid) throw new UsernameTakenError(newName);

    tx.set(newRef, { uid, email, username: newName });
    if (oldRef && oldSnap?.exists() && oldSnap.data().uid === uid) tx.delete(oldRef);
  });
}

/** Best effort: make sure an existing account's current username is registered (and its email is current). */
export async function ensureUsernameClaim(args: { uid: string; email?: string | null; username?: string }) {
  const { uid, email, username } = args;
  if (!email || !username?.trim()) return;
  const ref = doc(db, 'login_index', usernameKey(username));
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, { uid, email, username: normalizeUsername(username) });
  } else if (snap.data().uid === uid && snap.data().email !== email) {
    await setDoc(ref, { uid, email, username: normalizeUsername(username) });
  }
  // If someone else holds the key we leave it alone; the account keeps working, it just is not registered.
}
