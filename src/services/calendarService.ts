import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { haptics } from '../utils/haptics';

export interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  startTime: string;
  endTime: string;
  location?: string;
  sourceType: 'service' | 'ride';
  syncedWith: ('google' | 'apple')[];
}

// Handler for calendar synchronization permissions
export class CalendarSyncManager {
  private static STORAGE_PREF_KEY = 'konnects_calendar_sync_permissions';
  private static STORAGE_EVENTS_KEY = 'konnects_synced_calendar_events';

  /**
   * Permissions State
   */
  public static getPermissions(): { google: boolean; apple: boolean; autoSync: boolean } {
    try {
      const stored = localStorage.getItem(this.STORAGE_PREF_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error('Error reading calendar sync permissions:', e);
    }
    return { google: false, apple: false, autoSync: false };
  }

  public static savePermissions(permissions: { google: boolean; apple: boolean; autoSync: boolean }) {
    localStorage.setItem(this.STORAGE_PREF_KEY, JSON.stringify(permissions));
    haptics.success();
  }

  /**
   * Get all synced events
   */
  public static getSyncedEvents(): CalendarEvent[] {
    try {
      const stored = localStorage.getItem(this.STORAGE_EVENTS_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error(e);
    }
    return [];
  }

  /**
   * Primary sync trigger: Called automatically when services or ride bookings are scheduled/accepted.
   */
  public static async autoSyncEvent(eventInput: Omit<CalendarEvent, 'id' | 'syncedWith'>): Promise<{ googleSynced: boolean; appleSynced: boolean; event: CalendarEvent } | null> {
    const permissions = this.getPermissions();
    if (!permissions.autoSync) {
      console.log('Calendar Sync is disabled by configuration.');
      return null;
    }

    const syncedWith: ('google' | 'apple')[] = [];
    if (permissions.google) syncedWith.push('google');
    if (permissions.apple) syncedWith.push('apple');

    if (syncedWith.length === 0) {
      return null;
    }

    const newEvent: CalendarEvent = {
      ...eventInput,
      id: 'cal-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      syncedWith
    };

    // Save locally
    const currentEvents = this.getSyncedEvents();
    localStorage.setItem(this.STORAGE_EVENTS_KEY, JSON.stringify([newEvent, ...currentEvents]));

    // Trigger local audit log in Firestore
    try {
      await addDoc(collection(db, 'audit_logs'), {
        action: 'calendar_sync',
        eventTitle: eventInput.title,
        sourceType: eventInput.sourceType,
        syncedWith,
        timestamp: serverTimestamp()
      });
    } catch (e) {
      console.warn('Firestore calendar sync logging failed. Synced offline only.', e);
    }

    // Play tactile indicator
    haptics.medium();

    return {
      googleSynced: permissions.google,
      appleSynced: permissions.apple,
      event: newEvent
    };
  }
}
