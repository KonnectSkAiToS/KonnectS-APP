export interface PulseItem {
  id: string;
  title: string;
  description: string;
  category: 'project' | 'volunteer' | 'discussion';
  pointsReward?: number;
  location: string;
  dateOrReplies: string;
  supportersCount: number;
  rsvpedUsers?: string[];
  createdAt?: any;
}

export interface Reply {
  id: string;
  authorName: string;
  authorId: string;
  text: string;
  createdAt: string;
}

export interface ThreadItem {
  id: string;
  title: string;
  content: string;
  category: 'help' | 'general' | 'deals' | 'lost';
  authorName: string;
  authorId: string;
  reactions: number;
  replies: Reply[];
  createdAt: any;
}

export interface SafetyAlert {
  id: string;
  title: string;
  description: string;
  category: 'hazard' | 'utility' | 'weather' | 'incidents' | 'other';
  durationMinutes: number;
  radiusMiles: number;
  locationName: string;
  reporterName: string;
  createdAt: any;
  resolved: boolean;
}

export interface VolunteerHours {
  id: string;
  userId: string;
  charityName: string;
  hours: number;
  note?: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: any;
}
