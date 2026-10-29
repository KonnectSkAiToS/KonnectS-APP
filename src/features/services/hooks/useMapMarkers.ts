import { collection, query, where } from 'firebase/firestore';
import { useMemo } from 'react';
import { db } from '../../../lib/firebase';
import { useAuth } from '../../../contexts/AuthContext';
import { useFirestoreQuery } from '../../community/hooks/useFirestoreQuery';

export interface MapMarker { id: string; title: string; lat: number; lng: number; x: string; top: string }

// Shoreditch-area box used by the vector fallback map (Google Maps uses lat/lng directly).
const BOX = { latMin: 51.51, latMax: 51.535, lngMin: -0.1, lngMax: -0.065 };
const pct = (v: number, min: number, max: number) => Math.min(95, Math.max(5, ((v - min) / (max - min)) * 100));

const toMarker = (id: string, title: string, lat: number, lng: number): MapMarker => ({
  id, title, lat, lng,
  x: `${pct(lng, BOX.lngMin, BOX.lngMax)}%`,
  top: `${100 - pct(lat, BOX.latMin, BOX.latMax)}%`,
});

/** Transit hubs from the `hubs` collection ({ title, lat, lng }). Empty until that collection is populated. */
export function useHubs(): MapMarker[] {
  const { data } = useFirestoreQuery<{ id: string; title: string; lat: number; lng: number }>(
    () => query(collection(db, 'hubs')), [], 'hubs');
  return useMemo(() => data.filter(h => h.lat && h.lng).map(h => toMarker(h.id, h.title, h.lat, h.lng)), [data]);
}

/** The signed-in user's open bookings that have a location. */
export function useActiveBookings(): MapMarker[] {
  const { user } = useAuth();
  const uid = user?.uid;
  const { data } = useFirestoreQuery<{ id: string; serviceType: string; status: string; location?: { lat: number; lng: number } }>(
    () => (uid ? query(collection(db, 'bookings'), where('customerId', '==', uid)) : null), [uid], 'bookings');
  return useMemo(() => data
    .filter(b => ['pending', 'accepted', 'negotiating'].includes(b.status) && b.location)
    .map(b => toMarker(b.id, `${b.serviceType} booking (${b.status})`, b.location!.lat, b.location!.lng)), [data]);
}
