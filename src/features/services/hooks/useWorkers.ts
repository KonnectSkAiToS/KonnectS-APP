import { collection, limit, query, where } from 'firebase/firestore';
import { useMemo } from 'react';
import { db } from '../../../lib/firebase';
import type { UserProfile } from '../../../types';
import { useFirestoreQuery } from '../../community/hooks/useFirestoreQuery';
import type { Worker } from '../types';

const toWorker = (u: UserProfile): Worker => ({
  id: u.uid,
  name: u.fullName || u.username,
  role: u.skills?.[0] || u.workerType || 'Service Professional',
  locationName: u.location?.address || 'London',
  rating: u.rating ?? 0,
  reviews: u.reviewCount ?? 0,
  price: u.hourlyRate ?? 0,
  status: u.availabilityStatus === 'Busy' ? 'busy' : 'available',
  category: '', // sector is assigned by the caller (ServicesView owns the role -> sector map)
  bio: u.bio,
});

/** Live worker profiles from `users`. `category` is left empty for the caller to fill. */
export function useWorkers(max = 100) {
  const { data, ...rest } = useFirestoreQuery<UserProfile & { id: string }>(
    () => query(collection(db, 'users'), where('isWorker', '==', true), limit(max)),
    [max],
    'users',
  );
  const workers = useMemo(() => data.map(toWorker), [data]);
  return { workers, ...rest };
}
