/**
 * Guided-tour "has this person already seen it?" logic.
 *
 * A user counts as having completed the tour if ANY of these is true:
 *  - their Firestore profile has `hasCompletedTour: true` (follows them across devices)
 *  - this browser remembers it (`konnects_tour_completed_<uid>`)
 *  - the older key `urbanNet_tour_completed_<uid>` is set (people who finished it before this change)
 */
export type KeyValueStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export const tourKey = (uid: string) => `konnects_tour_completed_${uid}`;
export const legacyTourKey = (uid: string) => `urbanNet_tour_completed_${uid}`;

export function isTourCompleted(
  uid: string,
  profile?: { hasCompletedTour?: boolean } | null,
  store: KeyValueStore = localStorage
): boolean {
  if (profile?.hasCompletedTour === true) return true;
  return store.getItem(tourKey(uid)) === 'true' || store.getItem(legacyTourKey(uid)) === 'true';
}

export function markTourCompletedLocally(uid: string, store: KeyValueStore = localStorage) {
  store.setItem(tourKey(uid), 'true');
  store.setItem(legacyTourKey(uid), 'true');
}

/** Forget completion in this browser so the tour can be replayed. Does not touch Firestore. */
export function resetTourLocally(uid: string, store: KeyValueStore = localStorage) {
  store.removeItem(tourKey(uid));
  store.removeItem(legacyTourKey(uid));
}

/** The tour opens by itself only for people who have never completed (or skipped) it. */
export function shouldAutoShowTour(
  uid: string,
  profile: { hasCompletedTour?: boolean } | null | undefined,
  store: KeyValueStore = localStorage
): boolean {
  return !isTourCompleted(uid, profile, store);
}

/**
 * The voice-rule debugging panel is for developers only: development builds, or an explicit
 * opt-in flag (`localStorage.konnects_debug = 'true'`).
 */
export function isVoiceDebugEnabled(isDevBuild: boolean, store: KeyValueStore = localStorage): boolean {
  return isDevBuild || store.getItem('konnects_debug') === 'true';
}
