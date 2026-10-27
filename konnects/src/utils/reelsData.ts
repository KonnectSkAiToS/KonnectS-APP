/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { WorkerReel } from '../types/reels';

export const INITIAL_WORKER_REELS: WorkerReel[] = [
  {
    id: 'reel-plumb-01',
    workerId: 'worker-plumber-marco',
    workerName: 'Marco Rossi',
    workerRole: 'Gas Safe Master Plumber',
    workerAvatar: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?q=80&w=256&auto=format&fit=crop',
    workerRating: 4.96,
    workerBadge: 'Gas Safe Reg #639201',
    workerHourlyRate: 65,
    title: 'Emergency High-Pressure Copper Pipe Burst Repair',
    tradeCategory: 'plumbing',
    mediaType: 'video',
    mediaUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    thumbnailUrl: 'https://images.unsplash.com/photo-1585704032915-c3400ca199e7?q=80&w=800&auto=format&fit=crop',
    beforeImageUrl: 'https://images.unsplash.com/photo-1542013936693-884638332954?q=80&w=800&auto=format&fit=crop',
    afterImageUrl: 'https://images.unsplash.com/photo-1585704032915-c3400ca199e7?q=80&w=800&auto=format&fit=crop',
    description: 'Called out to a Victorian converted flat in Shoreditch with water pouring through the ceiling. Pinpointed pinhole corrosion in 22mm main riser, isolated mains, cut out calcified section, and soldered new copper coupling with Yorkshire ring fittings. Full pressure test holding at 4.2 bar.',
    location: 'Shoreditch High St, London E1',
    durationMinutes: 45,
    clientSavings: 'Saved client £1,800 ceiling ceiling restoration',
    toolsUsed: ['Rothenberger Tube Cutter', 'MAPP Gas Blowlamp', 'Thermal Leak Imager', 'Digital Manometer'],
    tags: ['#plumbing', '#emergencyrepair', '#copperpipe', '#leakfixed', '#londonplumber'],
    viewsCount: 1842,
    likesCount: 164,
    bookmarksCount: 42,
    createdAt: new Date(Date.now() - 3600000 * 5).toISOString()
  },
  {
    id: 'reel-plumb-02',
    workerId: 'worker-plumber-sarah',
    workerName: 'Sarah Jenkins',
    workerRole: 'Sanitary & Drainage Specialist',
    workerAvatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=256&auto=format&fit=crop',
    workerRating: 4.98,
    workerBadge: 'City & Guilds Level 3',
    workerHourlyRate: 60,
    title: 'Before & After: Complete Bathroom Waste & Bottle Trap Renovation',
    tradeCategory: 'plumbing',
    mediaType: 'before_after',
    mediaUrl: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?q=80&w=800&auto=format&fit=crop',
    thumbnailUrl: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?q=80&w=800&auto=format&fit=crop',
    beforeImageUrl: 'https://images.unsplash.com/photo-1504148455328-c376907d081c?q=80&w=800&auto=format&fit=crop',
    afterImageUrl: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?q=80&w=800&auto=format&fit=crop',
    description: 'Replaced a recurring leaky, badly aligned flexi-hose waste pipe that kept causing foul odors. Re-piped with rigid solvent weld 40mm waste, installed a modern chrome anti-syphon bottle trap and tested water flow at 18L/min. Zero leaks, whisper quiet draining.',
    location: 'Hoxton Square, London N1',
    durationMinutes: 60,
    clientSavings: 'Eliminated recurring drain blockage callouts',
    toolsUsed: ['Solvent Weld PVC Cement', 'Drain Inspection Scope', 'Adjustable Basin Wrench'],
    tags: ['#plumber', '#bathroomreno', '#bottletrap', '#drainage', '#plumbinglife'],
    viewsCount: 2310,
    likesCount: 219,
    bookmarksCount: 78,
    createdAt: new Date(Date.now() - 3600000 * 20).toISOString()
  },
  {
    id: 'reel-elec-01',
    workerId: 'worker-elec-dave',
    workerName: 'Dave Kalu',
    workerRole: 'NICEIC Approved Electrician',
    workerAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=256&auto=format&fit=crop',
    workerRating: 4.94,
    workerBadge: 'NICEIC Certified #09214',
    workerHourlyRate: 70,
    title: '18th Edition Dual RCD Consumer Unit Overhaul',
    tradeCategory: 'electrical',
    mediaType: 'video',
    mediaUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    thumbnailUrl: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?q=80&w=800&auto=format&fit=crop',
    beforeImageUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?q=80&w=800&auto=format&fit=crop',
    afterImageUrl: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?q=80&w=800&auto=format&fit=crop',
    description: 'Replaced a dangerous 1980s rewirable fuse box with a modern 10-way metal Consumer Unit featuring individual Type-A RCBOs and Type 2 Surge Protection (SPD). Complete insulation resistance test and Part P sign-off provided.',
    location: 'Bethnal Green, London E2',
    durationMinutes: 180,
    clientSavings: 'Saved 25% on annual home insurance premium',
    toolsUsed: ['Megger Multifunction Tester', 'Wiha VDE Torque Screwdrivers', 'Cable Strippers'],
    tags: ['#electrician', '#fuseboard', '#rcbo', '#surgeprotection', '#niceic'],
    viewsCount: 3120,
    likesCount: 345,
    bookmarksCount: 95,
    createdAt: new Date(Date.now() - 3600000 * 30).toISOString()
  },
  {
    id: 'reel-carp-01',
    workerId: 'worker-carp-liam',
    workerName: 'Liam O’Connor',
    workerRole: 'Master Carpenter & Joiner',
    workerAvatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=256&auto=format&fit=crop',
    workerRating: 4.97,
    workerBadge: 'Guild of Master Craftsmen',
    workerHourlyRate: 58,
    title: 'Custom Floating Oak Alcove Shelving with Hidden Warm LED',
    tradeCategory: 'carpentry',
    mediaType: 'before_after',
    mediaUrl: 'https://images.unsplash.com/photo-1538688525198-9b88f6f53126?q=80&w=800&auto=format&fit=crop',
    thumbnailUrl: 'https://images.unsplash.com/photo-1538688525198-9b88f6f53126?q=80&w=800&auto=format&fit=crop',
    beforeImageUrl: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?q=80&w=800&auto=format&fit=crop',
    afterImageUrl: 'https://images.unsplash.com/photo-1538688525198-9b88f6f53126?q=80&w=800&auto=format&fit=crop',
    description: 'Turned an awkward uneven chimney breast alcove into 4 heavy-duty solid European oak floating shelves. Routed channels underneath for concealed 2700K warm LED diffusers with touch dimming. Holds up to 45kg per shelf.',
    location: 'Islington, London N1',
    durationMinutes: 240,
    clientSavings: 'Bespoke joinery for 40% less than high-street design studios',
    toolsUsed: ['Festool Plunge Saw', 'DeWalt Router', 'Laser Level', 'Osmo Polyx-Oil'],
    tags: ['#carpentry', '#woodworking', '#alcoveshelves', '#interiordesign', '#handcrafted'],
    viewsCount: 4500,
    likesCount: 512,
    bookmarksCount: 180,
    createdAt: new Date(Date.now() - 3600000 * 48).toISOString()
  },
  {
    id: 'reel-handy-01',
    workerId: 'worker-handy-tariq',
    workerName: 'Tariq Al-Mansoor',
    workerRole: 'Pro Handyman & Tiler',
    workerAvatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?q=80&w=256&auto=format&fit=crop',
    workerRating: 4.92,
    workerBadge: 'Verified Trade Pro',
    workerHourlyRate: 48,
    title: 'Shower Enclosure Waterproof Re-Silicone & Anti-Mould Grouting',
    tradeCategory: 'handyman',
    mediaType: 'video',
    mediaUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
    thumbnailUrl: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?q=80&w=800&auto=format&fit=crop',
    description: 'Stripped black mouldy deteriorated bathroom sealant using mechanical scraper and chemical residue remover. Prepped with isopropyl alcohol and applied commercial antimicrobial sanitary silicone with flawless continuous bead tooling.',
    location: 'Clerkenwell, London EC1',
    durationMinutes: 75,
    clientSavings: 'Prevented subfloor rot & water damage down to flat below',
    toolsUsed: ['Fugi Silicone Tool Set', 'Cramer Mould Remover', 'Professional Sealant Gun'],
    tags: ['#handyman', '#tiling', '#silicone', '#waterproofing', '#londonhandyman'],
    viewsCount: 1620,
    likesCount: 138,
    bookmarksCount: 36,
    createdAt: new Date(Date.now() - 3600000 * 60).toISOString()
  }
];

const STORAGE_KEY = 'konnects_worker_reels_v1';

export function getStoredLocalReels(): WorkerReel[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Failed to read local reels:', err);
  }
  return INITIAL_WORKER_REELS;
}

export function saveStoredLocalReels(reels: WorkerReel[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(reels));
  } catch (err) {
    console.warn('Failed to save local reels:', err);
  }
}

export function addLocalReel(newReel: WorkerReel): WorkerReel[] {
  const current = getStoredLocalReels();
  const updated = [newReel, ...current];
  saveStoredLocalReels(updated);
  return updated;
}
