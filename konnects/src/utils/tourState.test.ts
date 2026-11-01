import { describe, it, expect } from 'vitest';
import {
  isTourCompleted, markTourCompletedLocally, resetTourLocally, shouldAutoShowTour, isVoiceDebugEnabled,
  tourKey, legacyTourKey, type KeyValueStore,
} from './tourState';

function fakeStore(initial: Record<string, string> = {}): KeyValueStore & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
    removeItem: (k) => { delete data[k]; },
  };
}

describe('guided tour state', () => {
  it('auto-shows for a brand new user (no flag anywhere)', () => {
    expect(shouldAutoShowTour('u1', { }, fakeStore())).toBe(true);
    expect(shouldAutoShowTour('u1', null, fakeStore())).toBe(true);
  });

  it('does not auto-show when the Firestore flag is true, even on a fresh device', () => {
    expect(shouldAutoShowTour('u1', { hasCompletedTour: true }, fakeStore())).toBe(false);
  });

  it('does not auto-show when this browser remembers completion', () => {
    expect(shouldAutoShowTour('u1', {}, fakeStore({ [tourKey('u1')]: 'true' }))).toBe(false);
  });

  it('respects the older key so people who already finished are not shown it again', () => {
    expect(shouldAutoShowTour('u1', {}, fakeStore({ [legacyTourKey('u1')]: 'true' }))).toBe(false);
  });

  it('treats hasCompletedTour: false as "not completed"', () => {
    expect(shouldAutoShowTour('u1', { hasCompletedTour: false }, fakeStore())).toBe(true);
  });

  it('is per user: one person finishing does not hide it for another on the same browser', () => {
    const store = fakeStore();
    markTourCompletedLocally('alice', store);
    expect(isTourCompleted('alice', {}, store)).toBe(true);
    expect(isTourCompleted('bob', {}, store)).toBe(false);
  });

  it('skip/finish stores the local flag so it never auto-opens again', () => {
    const store = fakeStore();
    expect(shouldAutoShowTour('u1', {}, store)).toBe(true);
    markTourCompletedLocally('u1', store);
    expect(shouldAutoShowTour('u1', {}, store)).toBe(false);
  });

  it('restart clears the local flags only', () => {
    const store = fakeStore();
    markTourCompletedLocally('u1', store);
    resetTourLocally('u1', store);
    expect(store.data).toEqual({});
    // the Firestore flag still says completed, so it still will not pop up by itself
    expect(shouldAutoShowTour('u1', { hasCompletedTour: true }, store)).toBe(false);
  });

  it('voice debug panel: off in production, on in dev or with the explicit flag', () => {
    expect(isVoiceDebugEnabled(false, fakeStore())).toBe(false);
    expect(isVoiceDebugEnabled(true, fakeStore())).toBe(true);
    expect(isVoiceDebugEnabled(false, fakeStore({ konnects_debug: 'true' }))).toBe(true);
    expect(isVoiceDebugEnabled(false, fakeStore({ konnects_debug: 'false' }))).toBe(false);
  });
});
