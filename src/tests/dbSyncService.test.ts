// Polyfill browser globals for Vitest environment before imports
const mockLocalStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {}
};

const mockWindow = {
  dispatchEvent: () => {},
  addEventListener: () => {},
  removeEventListener: () => {}
};

Object.defineProperty(globalThis, 'localStorage', { value: mockLocalStorage, writable: true, configurable: true });
Object.defineProperty(globalThis, 'window', { value: mockWindow, writable: true, configurable: true });
Object.defineProperty(global, 'localStorage', { value: mockLocalStorage, writable: true, configurable: true });
Object.defineProperty(global, 'window', { value: mockWindow, writable: true, configurable: true });

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  queueOfflineSync, 
  clearOfflineQueue, 
  offlineSyncQueue, 
  resolveConflict 
} from '../services/dbSyncService';

describe('dbSyncService - Synchronize, Offline Queuing and Conflict Resolution', () => {
  beforeEach(() => {
    clearOfflineQueue();
  });

  it('correctly queues items for offline synchronization', () => {
    expect(offlineSyncQueue.length).toBe(0);

    const testItem = queueOfflineSync(
      'booking-101',
      'bookings',
      'UPSERT',
      { service_type: 'Rides', price: 25.0 }
    );

    expect(offlineSyncQueue.length).toBe(1);
    expect(offlineSyncQueue[0]).toEqual(testItem);
    expect(offlineSyncQueue[0].id).toBe('booking-101');
    expect(offlineSyncQueue[0].action).toBe('UPSERT');
    expect(offlineSyncQueue[0].payload.price).toBe(25.0);
  });

  it('clears offline queue correctly', () => {
    queueOfflineSync('user-abc', 'users', 'UPSERT', { username: 'testuser' });
    queueOfflineSync('item-xyz', 'items', 'DELETE', null);
    
    expect(offlineSyncQueue.length).toBe(2);
    
    clearOfflineQueue();
    expect(offlineSyncQueue.length).toBe(0);
  });

  it('resolves conflicts using Last-Write-Wins (local newer)', () => {
    const localRecord = {
      id: 'item-1',
      title: 'Premium Mountain Bike',
      updated_at: '2026-06-20T10:00:00.000Z'
    };

    const remoteRecord = {
      id: 'item-1',
      title: 'Standard Mountain Bike',
      updated_at: '2026-06-20T09:00:00.000Z'
    };

    const resolution = resolveConflict(localRecord, remoteRecord);
    expect(resolution.source).toBe('local');
    expect(resolution.resolved.title).toBe('Premium Mountain Bike');
  });

  it('resolves conflicts using Last-Write-Wins (remote newer)', () => {
    const localRecord = {
      id: 'item-1',
      title: 'Premium Mountain Bike',
      updated_at: '2026-06-20T08:00:00.000Z'
    };

    const remoteRecord = {
      id: 'item-1',
      title: 'Standard Mountain Bike',
      updated_at: '2026-06-20T09:00:00.000Z'
    };

    const resolution = resolveConflict(localRecord, remoteRecord);
    expect(resolution.source).toBe('remote');
    expect(resolution.resolved.title).toBe('Standard Mountain Bike');
  });

  it('handles missing or invalid timestamps gracefully on resolution', () => {
    const localRecord = {
      id: 'item-1',
      title: 'Local Item No Timestamp'
    };

    const remoteRecord = {
      id: 'item-1',
      title: 'Remote Item No Timestamp'
    };

    // Both missing, defaults to 0 <= 0, resolving local fallback
    const resolution = resolveConflict(localRecord, remoteRecord);
    expect(resolution.source).toBe('local');
  });
});
