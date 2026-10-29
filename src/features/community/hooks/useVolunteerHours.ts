import { addDoc, collection, query, serverTimestamp, where } from 'firebase/firestore';
import { useMemo } from 'react';
import { db } from '../../../lib/firebase';
import { useAuth } from '../../../contexts/AuthContext';
import type { VolunteerHours } from '../types';
import { useFirestoreQuery } from './useFirestoreQuery';

export function useVolunteerHours() {
  const { user } = useAuth();
  const uid = user?.uid;
  // Sorted client-side: where() + orderBy() would need a composite index.
  const state = useFirestoreQuery<VolunteerHours>(
    () => (uid ? query(collection(db, 'volunteer_hours'), where('userId', '==', uid)) : null),
    [uid],
    'volunteer_hours',
  );
  const entries = useMemo(
    () => [...state.data].sort((a, b) => (b.createdAt?.seconds ?? Infinity) - (a.createdAt?.seconds ?? Infinity)),
    [state.data],
  );
  const approvedHours = entries.filter(e => e.status === 'approved').reduce((n, e) => n + e.hours, 0);
  const pendingHours = entries.filter(e => e.status === 'pending').reduce((n, e) => n + e.hours, 0);

  const logHours = (charityName: string, hours: number, note?: string) => {
    if (!uid) throw new Error('Sign in to log volunteer hours');
    if (!(hours > 0 && hours <= 24)) throw new Error('Hours must be between 0 and 24');
    return addDoc(collection(db, 'volunteer_hours'), {
      userId: uid, charityName, hours, note: note ?? '', status: 'pending', createdAt: serverTimestamp(),
    });
  };

  return { ...state, entries, approvedHours, pendingHours, logHours };
}
