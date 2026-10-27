/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type ReelMediaType = 'video' | 'picture' | 'before_after';

export type ReelTradeCategory = 
  | 'plumbing'
  | 'electrical'
  | 'carpentry'
  | 'painting'
  | 'cleaning'
  | 'handyman'
  | 'hvac'
  | 'security'
  | 'other';

export interface WorkerReel {
  id: string;
  workerId: string;
  workerName: string;
  workerRole: string;
  workerAvatar?: string;
  workerRating?: number;
  workerBadge?: string;
  workerHourlyRate?: number;
  
  title: string;
  tradeCategory: ReelTradeCategory;
  mediaType: ReelMediaType;
  mediaUrl: string;
  thumbnailUrl?: string;
  beforeImageUrl?: string;
  afterImageUrl?: string;
  
  description: string;
  location: string;
  durationMinutes?: number;
  clientSavings?: string;
  toolsUsed?: string[];
  tags: string[];
  
  viewsCount: number;
  likesCount: number;
  bookmarksCount: number;
  likedBy?: string[];
  
  createdAt: any;
}

export type PostType = 'tip' | 'experience' | 'question' | 'showcase' | 'alert';

export interface PostComment {
  id: string;
  authorId: string;
  authorName: string;
  authorRole?: string;
  authorAvatar?: string;
  authorBadge?: string;
  comment: string;
  createdAt: string;
  likesCount?: number;
}

export interface WorkerPost {
  id: string;
  authorId: string;
  authorName: string;
  authorRole: string;
  authorAvatar?: string;
  authorBadge?: string;
  authorRating?: number;
  tradeCategory: ReelTradeCategory;
  postType: PostType;
  title: string;
  content: string;
  images?: string[];
  beforeImage?: string;
  afterImage?: string;
  location?: string;
  likesCount: number;
  commentsCount: number;
  tags: string[];
  likedBy?: string[];
  createdAt: any;
  comments?: PostComment[];
}

export interface WorkPhotoItem {
  id: string;
  workerId: string;
  workerName: string;
  workerRole: string;
  workerAvatar?: string;
  workerRating?: number;
  workerBadge?: string;
  title: string;
  tradeCategory: ReelTradeCategory;
  imageUrl: string;
  beforeImageUrl?: string;
  afterImageUrl?: string;
  description: string;
  location: string;
  projectCost?: string;
  completionTime?: string;
  toolsUsed?: string[];
  tags: string[];
  likesCount: number;
  viewsCount: number;
  createdAt: any;
}

