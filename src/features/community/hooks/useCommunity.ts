import { collection, limit, orderBy, query } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import type { PulseItem, SafetyAlert, ThreadItem } from '../types';
import { useFirestoreQuery } from './useFirestoreQuery';

const newest = (path: string, max: number) => () =>
  query(collection(db, path), orderBy('createdAt', 'desc'), limit(max));

export const useCommunityFeed = (max = 50) =>
  useFirestoreQuery<PulseItem>(newest('community_pulse', max), [max], 'community_pulse');

export const useDiscussions = (max = 50) =>
  useFirestoreQuery<ThreadItem>(newest('discussions', max), [max], 'discussions');

export const useSafetyAlerts = (max = 50) =>
  useFirestoreQuery<SafetyAlert>(newest('safety_alerts', max), [max], 'safety_alerts');
