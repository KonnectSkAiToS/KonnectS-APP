/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { WorkerPost, WorkPhotoItem } from '../types/reels';

export const INITIAL_WORKER_POSTS: WorkerPost[] = [
  {
    id: 'post-plumb-01',
    authorId: 'worker-plumber-marco',
    authorName: 'Marco Rossi',
    authorRole: 'Gas Safe Master Plumber',
    authorAvatar: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?q=80&w=256&auto=format&fit=crop',
    authorBadge: 'Gas Safe Reg #639201',
    authorRating: 4.96,
    tradeCategory: 'plumbing',
    postType: 'tip',
    title: 'Why £5 appliance flexi-hoses flood more London flats than frozen pipes',
    content: 'Just finished an emergency callout in Shoreditch High St. Homeowner left for a weekend trip, came back to 3 inches of standing water because the rubber washer in a 6-year-old braided washing machine hose degraded and cracked under mains pressure.\n\n🛠 PRO TIP FOR NEIGHBORS:\n1. Flexible stainless braided hoses have an internal EPDM rubber lining that hardens after 4–5 years.\n2. Always install an easily accessible quarter-turn lever isolation valve right before the appliance.\n3. If leaving home for >48h, turn the appliance isolation lever OFF. Takes 5 seconds and prevents catastrophic £5k+ flooring damage!\n\nFeel free to ask questions below if you suspect a slow leak!',
    images: [
      'https://images.unsplash.com/photo-1585704032915-c3400ca199e7?q=80&w=800&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1542013936693-884638332954?q=80&w=800&auto=format&fit=crop'
    ],
    beforeImage: 'https://images.unsplash.com/photo-1542013936693-884638332954?q=80&w=800&auto=format&fit=crop',
    afterImage: 'https://images.unsplash.com/photo-1585704032915-c3400ca199e7?q=80&w=800&auto=format&fit=crop',
    location: 'Shoreditch, London E1',
    likesCount: 148,
    commentsCount: 19,
    tags: ['#plumbing', '#protip', '#leakprevention', '#londonhomes'],
    createdAt: new Date(Date.now() - 3600000 * 4).toISOString(),
    comments: [
      {
        id: 'c1',
        authorId: 'user-sam',
        authorName: 'Samira Patel',
        authorRole: 'Resident • Hoxton',
        comment: 'This is brilliant advice Marco! Does this also apply to dishwasher inlet hoses?',
        createdAt: new Date(Date.now() - 3600000 * 3).toISOString()
      },
      {
        id: 'c2',
        authorId: 'worker-plumber-marco',
        authorName: 'Marco Rossi',
        authorRole: 'Gas Safe Master Plumber',
        authorBadge: 'Gas Safe Reg #639201',
        comment: 'Yes 100%! Dishwasher hoses experience the exact same hot/cold expansion cycles. Make sure you check the rubber seating annually.',
        createdAt: new Date(Date.now() - 3600000 * 2).toISOString()
      }
    ]
  },
  {
    id: 'post-elec-01',
    authorId: 'worker-elec-dave',
    authorName: 'Dave Kalu',
    authorRole: 'NICEIC Approved Electrician',
    authorAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=256&auto=format&fit=crop',
    authorBadge: 'NICEIC Certified #09214',
    authorRating: 4.94,
    tradeCategory: 'electrical',
    postType: 'experience',
    title: 'Complete Victorian rewire: Hidden conduit behind lath-and-plaster walls',
    content: 'Completed a full rewiring on a 3-storey Victorian townhouse in Bethnal Green without taking down the historic ornate cornicing! Used micro-bore flexible snake rods and thermal cameras to trace existing wall cavities.\n\nUpgraded to a 12-way split-load metal Consumer Unit with Type-A RCBOs on every circuit and Type 2 Surge Protection Device (SPD). Tested with Megger 1741+ multifunction tester. Zero nuisance tripping, 100% compliant with 18th Edition Amendment 2.',
    images: [
      'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?q=80&w=800&auto=format&fit=crop'
    ],
    beforeImage: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?q=80&w=800&auto=format&fit=crop',
    afterImage: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?q=80&w=800&auto=format&fit=crop',
    location: 'Bethnal Green, London E2',
    likesCount: 215,
    commentsCount: 14,
    tags: ['#electrician', '#victorianhouse', '#rewire', '#surgeprotection', '#18thedition'],
    createdAt: new Date(Date.now() - 3600000 * 18).toISOString(),
    comments: [
      {
        id: 'c3',
        authorId: 'user-lucas',
        authorName: 'Lucas Bennett',
        authorRole: 'Homeowner',
        comment: 'Dave did our fuseboard upgrade last month and was super tidy. Cleaned up every bit of plaster dust!',
        createdAt: new Date(Date.now() - 3600000 * 12).toISOString()
      }
    ]
  },
  {
    id: 'post-qa-01',
    authorId: 'user-chloe',
    authorName: 'Chloe Bennett',
    authorRole: 'Resident • Hoxton Square',
    authorAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=256&auto=format&fit=crop',
    tradeCategory: 'plumbing',
    postType: 'question',
    title: 'Ask a Pro: Why does my shower go freezing cold when the washing machine fills?',
    content: 'Hoping one of the verified local plumbers on KonnectS can help! We live on the 2nd floor. Whenever the washing machine starts rinsing or the kitchen tap runs, our mixer shower turns ice cold and pressure drops to almost zero. Is this something that can be fixed with a thermostatic mixer valve or do we need a new combi boiler?',
    location: 'Hoxton, London N1',
    likesCount: 67,
    commentsCount: 6,
    tags: ['#askapro', '#showerpressure', '#plumbinghelp', '#localtrades'],
    createdAt: new Date(Date.now() - 3600000 * 28).toISOString(),
    comments: [
      {
        id: 'c4',
        authorId: 'worker-plumber-marco',
        authorName: 'Marco Rossi',
        authorRole: 'Gas Safe Master Plumber',
        authorBadge: 'Gas Safe Reg #639201',
        comment: 'Hi Chloe! This is a classic pressure imbalance between your hot (gravity or combi) and mains cold feed. If your mixer valve is manual, it cannot compensate for the pressure drop. Installing a thermostatic bar valve with built-in non-return check valves will prevent cold surges completely!',
        createdAt: new Date(Date.now() - 3600000 * 24).toISOString()
      },
      {
        id: 'c5',
        authorId: 'worker-plumber-sarah',
        authorName: 'Sarah Jenkins',
        authorRole: 'Sanitary Specialist',
        authorBadge: 'City & Guilds Level 3',
        comment: 'Seconding Marco! Also check if you have an unvented pressure reducing valve (PRV) at the mains inlet set too low.',
        createdAt: new Date(Date.now() - 3600000 * 20).toISOString()
      }
    ]
  },
  {
    id: 'post-carp-01',
    authorId: 'worker-carp-liam',
    authorName: 'Liam O’Connor',
    authorRole: 'Master Carpenter & Joiner',
    authorAvatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=256&auto=format&fit=crop',
    authorBadge: 'Guild of Master Craftsmen',
    authorRating: 4.97,
    tradeCategory: 'carpentry',
    postType: 'showcase',
    title: 'Solid European Oak custom floating alcoves with touch-dimming warm LED channels',
    content: 'Finished this project in Islington today. The alcoves were out of square by 18mm from front to back (typical for 1890s brickwork!). Scribed each 40mm thick oak plank on site with a Festool guide rail for a zero-gap shadowline finish.\n\nIntegrated 2700K 24V LED strip lights with hidden recessed aluminum channels and diffuser lenses. All wiring routed invisibly through rear studding into a smart wireless dimmer switch.',
    images: [
      'https://images.unsplash.com/photo-1538688525198-9b88f6f53126?q=80&w=800&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1513694203232-719a280e022f?q=80&w=800&auto=format&fit=crop'
    ],
    beforeImage: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?q=80&w=800&auto=format&fit=crop',
    afterImage: 'https://images.unsplash.com/photo-1538688525198-9b88f6f53126?q=80&w=800&auto=format&fit=crop',
    location: 'Islington, London N1',
    likesCount: 382,
    commentsCount: 28,
    tags: ['#carpentry', '#woodworking', '#alcoveshelves', '#interiordesign', '#craftsmanship'],
    createdAt: new Date(Date.now() - 3600000 * 52).toISOString()
  }
];

export const INITIAL_WORK_PHOTOS: WorkPhotoItem[] = [
  {
    id: 'photo-01',
    workerId: 'worker-plumber-marco',
    workerName: 'Marco Rossi',
    workerRole: 'Gas Safe Master Plumber',
    workerAvatar: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?q=80&w=256&auto=format&fit=crop',
    workerRating: 4.96,
    workerBadge: 'Gas Safe Reg #639201',
    title: 'High-Pressure Copper Riser Overhaul & Solder Joints',
    tradeCategory: 'plumbing',
    imageUrl: 'https://images.unsplash.com/photo-1585704032915-c3400ca199e7?q=80&w=1200&auto=format&fit=crop',
    beforeImageUrl: 'https://images.unsplash.com/photo-1542013936693-884638332954?q=80&w=1200&auto=format&fit=crop',
    afterImageUrl: 'https://images.unsplash.com/photo-1585704032915-c3400ca199e7?q=80&w=1200&auto=format&fit=crop',
    description: 'Pinpointed pinhole leak in 22mm main water riser. Replaced defective run with C106 hard-drawn copper tube and soldered lead-free capillary fittings. Pressure test holding at 4.2 bar.',
    location: 'Shoreditch, London E1',
    projectCost: '£185',
    completionTime: '1 hr 15 mins',
    toolsUsed: ['Rothenberger Tube Cutter', 'MAPP Gas Torch', 'Pressure Manometer'],
    tags: ['#plumbing', '#copperpipes', '#leakrepair', '#certified'],
    likesCount: 89,
    viewsCount: 1240,
    createdAt: new Date(Date.now() - 3600000 * 10).toISOString()
  },
  {
    id: 'photo-02',
    workerId: 'worker-plumber-sarah',
    workerName: 'Sarah Jenkins',
    workerRole: 'Sanitary & Drainage Specialist',
    workerAvatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=256&auto=format&fit=crop',
    workerRating: 4.98,
    workerBadge: 'City & Guilds Level 3',
    title: 'Anti-Syphon Chrome Bottle Trap & Solvent Weld Upgrade',
    tradeCategory: 'plumbing',
    imageUrl: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?q=80&w=1200&auto=format&fit=crop',
    beforeImageUrl: 'https://images.unsplash.com/photo-1504148455328-c376907d081c?q=80&w=1200&auto=format&fit=crop',
    afterImageUrl: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?q=80&w=1200&auto=format&fit=crop',
    description: 'Replaced a deteriorated corrugated flexi waste pipe that accumulated grease and bad smells with rigid solvent-weld piping and polished chrome waste.',
    location: 'Hoxton Square, London N1',
    projectCost: '£140',
    completionTime: '50 mins',
    toolsUsed: ['Solvent PVC Weld', 'Basin Wrench', 'Plumbers Putty'],
    tags: ['#sanitary', '#bathroomreno', '#plumbinglife'],
    likesCount: 112,
    viewsCount: 1820,
    createdAt: new Date(Date.now() - 3600000 * 22).toISOString()
  },
  {
    id: 'photo-03',
    workerId: 'worker-carp-liam',
    workerName: 'Liam O’Connor',
    workerRole: 'Master Carpenter & Joiner',
    workerAvatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=256&auto=format&fit=crop',
    workerRating: 4.97,
    workerBadge: 'Guild of Master Craftsmen',
    title: 'Solid European Oak Floating Shelves with LED Inset',
    tradeCategory: 'carpentry',
    imageUrl: 'https://images.unsplash.com/photo-1538688525198-9b88f6f53126?q=80&w=1200&auto=format&fit=crop',
    beforeImageUrl: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?q=80&w=1200&auto=format&fit=crop',
    afterImageUrl: 'https://images.unsplash.com/photo-1538688525198-9b88f6f53126?q=80&w=1200&auto=format&fit=crop',
    description: 'Bespoke alcove shelves crafted from kiln-dried European Oak, treated with matte Osmo Polyx-Oil. Heavy-duty internal steel rods rated for 50kg load per shelf.',
    location: 'Islington, London N1',
    projectCost: '£720',
    completionTime: '1 day',
    toolsUsed: ['Festool Plunge Saw', 'Router', 'Laser Level'],
    tags: ['#woodwork', '#joinery', '#bespokedesign', '#oak'],
    likesCount: 245,
    viewsCount: 3100,
    createdAt: new Date(Date.now() - 3600000 * 45).toISOString()
  },
  {
    id: 'photo-04',
    workerId: 'worker-elec-dave',
    workerName: 'Dave Kalu',
    workerRole: 'NICEIC Approved Electrician',
    workerAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=256&auto=format&fit=crop',
    workerRating: 4.94,
    workerBadge: 'NICEIC Certified #09214',
    title: 'Dual RCD Metal Consumer Unit & Surge Protection',
    tradeCategory: 'electrical',
    imageUrl: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?q=80&w=1200&auto=format&fit=crop',
    beforeImageUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?q=80&w=1200&auto=format&fit=crop',
    afterImageUrl: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?q=80&w=1200&auto=format&fit=crop',
    description: 'Decommissioned dangerous rewireable ceramic fuseboard. Fitted high-grade Hager metal unit with RCBOs on each circuit and surge protection.',
    location: 'Bethnal Green, London E2',
    projectCost: '£650',
    completionTime: '4 hrs',
    toolsUsed: ['Megger Multifunction', 'Wiha Torque Screwdriver'],
    tags: ['#fuseboard', '#safetyfirst', '#electricianlondon'],
    likesCount: 167,
    viewsCount: 2490,
    createdAt: new Date(Date.now() - 3600000 * 60).toISOString()
  }
];

const POSTS_STORAGE_KEY = 'konnects_worker_posts_v1';
const PHOTOS_STORAGE_KEY = 'konnects_work_photos_v1';

export function getStoredLocalPosts(): WorkerPost[] {
  try {
    const raw = localStorage.getItem(POSTS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Failed to read local posts:', err);
  }
  return INITIAL_WORKER_POSTS;
}

export function saveStoredLocalPosts(posts: WorkerPost[]) {
  try {
    localStorage.setItem(POSTS_STORAGE_KEY, JSON.stringify(posts));
  } catch (err) {
    console.warn('Failed to save local posts:', err);
  }
}

export function addLocalPost(newPost: WorkerPost): WorkerPost[] {
  const current = getStoredLocalPosts();
  const updated = [newPost, ...current];
  saveStoredLocalPosts(updated);
  return updated;
}

export function getStoredLocalPhotos(): WorkPhotoItem[] {
  try {
    const raw = localStorage.getItem(PHOTOS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Failed to read local photos:', err);
  }
  return INITIAL_WORK_PHOTOS;
}

export function saveStoredLocalPhotos(photos: WorkPhotoItem[]) {
  try {
    localStorage.setItem(PHOTOS_STORAGE_KEY, JSON.stringify(photos));
  } catch (err) {
    console.warn('Failed to save local photos:', err);
  }
}

export function addLocalPhoto(newPhoto: WorkPhotoItem): WorkPhotoItem[] {
  const current = getStoredLocalPhotos();
  const updated = [newPhoto, ...current];
  saveStoredLocalPhotos(updated);
  return updated;
}
