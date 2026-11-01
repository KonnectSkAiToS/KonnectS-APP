import { useEffect, useRef } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { ensureUsernameClaim } from './usernameRegistry';

/**
 * Two quiet clean-ups that run once per sign-in:
 *  1. After someone confirms a new email (verification link), the sign-in email changes first;
 *     copy it onto the profile so the two never disagree.
 *  2. Register the current username so it is protected from being taken by someone else
 *     (accounts created before the registry existed have not claimed it yet).
 */
export function useProfileSelfHealing() {
  const { user, profile, loading } = useAuth();
  const lastRun = useRef('');

  useEffect(() => {
    if (loading || !user || !profile || profile.uid !== user.uid) return;
    const stamp = `${user.uid}|${user.email}|${profile.email}|${profile.username}`;
    if (lastRun.current === stamp) return;
    lastRun.current = stamp;

    (async () => {
      try {
        const authEmail = auth.currentUser?.email;
        if (authEmail && profile.email && authEmail.toLowerCase() !== profile.email.toLowerCase()) {
          await auth.currentUser!.getIdToken(true); // the security rules compare against the token's email
          await setDoc(doc(db, 'users', user.uid), { email: authEmail }, { merge: true });
        }
        await ensureUsernameClaim({ uid: user.uid, email: authEmail, username: profile.username });
      } catch (err) {
        console.warn('[profile] background clean-up skipped:', err);
      }
    })();
  }, [loading, user, profile]);
}
