/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type WorkerType = 'plumber' | 'mechanic' | 'doctor' | 'electrician' | 'cleaner' | 'cab_owner' | 'other';
export type VerificationStatus = 'pending' | 'verified' | 'rejected' | 'in_progress';
export type ItemStatus = 'available' | 'sold' | 'deleted' | 'pending_pickup' | 'delivered';
export type ItemCondition = 'new' | 'used_good' | 'used_fair' | 'parts';
export type ServiceStatus = 'requested' | 'accepted' | 'completed' | 'cancelled';

export interface UserProfile {
  uid: string;
  email: string;
  username: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  dateOfBirth?: string;
  gender?: string;
  avatarUrl?: string;
  mobileNumber?: string;
  isWorker: boolean;
  isWorkerMode?: boolean; 
  workerType?: WorkerType;
  verificationStatus?: VerificationStatus;
  verificationStep?: string;
  documents?: string[];
  rewardsPoints: number;
  referralCode: string;
  invitedBy?: string;
  hourlyRate?: number;
  isOnline?: boolean;
  rating?: number;
  reviewCount?: number;
  savedItems?: string[];
  autoAcceptConfig?: {
    enabled: boolean;
    maxPrice?: number;
    minPrice?: number;
    serviceTypes?: string[];
  };
  createdAt: any;
}

export interface MarketplaceItem {
  id: string;
  sellerId: string;
  title: string;
  description: string;
  price: number;
  isFree: boolean;
  category: string;
  images?: string[];
  status: ItemStatus;
  condition?: ItemCondition;
  location?: {
    lat: number;
    lng: number;
    address: string;
  };
  createdAt: any;
}

export interface ServiceBooking {
  id: string;
  customerId: string;
  workerId?: string;
  serviceType: string;
  status: 'pending' | 'accepted' | 'completed' | 'cancelled' | 'timed_out' | 'negotiating';
  description: string;
  location?: {
    lat: number;
    lng: number;
    address: string;
  };
  pickupLocation?: {
    lat: number;
    lng: number;
    address: string;
  };
  dropoffLocation?: {
    lat: number;
    lng: number;
    address: string;
  };
  price?: number;
  suggestedPrice?: number;
  estimatedCompletionTime?: string;
  expiresAt: any;
  createdAt: any;
  updatedAt?: any;
}

export interface RideRequest {
  id: string;
  passengerId: string;
  driverId?: string;
  pickup: string;
  dropoff: string;
  status: 'searching' | 'accepted' | 'in-progress' | 'completed' | 'timed_out';
  price: number;
  expiresAt: any;
  createdAt: any;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  recipientId: string;
  text: string;
  timestamp: any;
}
