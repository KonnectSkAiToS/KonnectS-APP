import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';

const RESERVED_USERNAMES = [
  'alex_m',
  'sarah_m',
  'elena_r',
  'david_c',
  'marcus_v',
  'james_w',
  'admin',
  'root',
  'system',
  'konnects'
];

/**
 * Checks if a username/User ID handle is already taken by another user.
 * @param requestedUsername The new username being checked
 * @param currentUserId The current authenticated user's UID
 * @param currentUsername The current user's existing username
 * @returns Object with isTaken boolean and error message if taken
 */
export async function isUsernameTaken(
  requestedUsername: string,
  currentUserId?: string,
  currentUsername?: string
): Promise<{ isTaken: boolean; reason?: string }> {
  const cleanHandle = requestedUsername.trim().toLowerCase().replace(/^@/, '');

  if (!cleanHandle) {
    return { isTaken: true, reason: 'User ID / Username cannot be empty.' };
  }

  // If user hasn't changed their username, it's allowed
  if (currentUsername && cleanHandle === currentUsername.trim().toLowerCase().replace(/^@/, '')) {
    return { isTaken: false };
  }

  // Check reserved / existing mock usernames
  if (RESERVED_USERNAMES.includes(cleanHandle) && (!currentUsername || cleanHandle !== currentUsername.trim().toLowerCase())) {
    return {
      isTaken: true,
      reason: `User ID '@${cleanHandle}' is already registered to another account.`
    };
  }

  // Query Firestore users collection
  try {
    const q1 = query(collection(db, 'users'), where('username', '==', cleanHandle));
    const snap1 = await getDocs(q1);

    for (const userDoc of snap1.docs) {
      if (userDoc.id !== currentUserId) {
        return {
          isTaken: true,
          reason: `User ID '@${cleanHandle}' is already taken. Please choose a different ID.`
        };
      }
    }

    // Also check exact case match or original string match
    const q2 = query(collection(db, 'users'), where('username', '==', requestedUsername.trim()));
    const snap2 = await getDocs(q2);

    for (const userDoc of snap2.docs) {
      if (userDoc.id !== currentUserId) {
        return {
          isTaken: true,
          reason: `User ID '@${requestedUsername.trim()}' is already taken. Please choose a different ID.`
        };
      }
    }
  } catch (err) {
    console.warn('[UsernameCheck] Firestore query warning:', err);
  }

  return { isTaken: false };
}
