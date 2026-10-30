import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  addDoc, arrayUnion, collection, deleteDoc, doc, getDoc, getDocs, increment, limit, query,
  serverTimestamp, setDoc, Timestamp, updateDoc, where,
} from 'firebase/firestore';

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-konnects',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
});
afterAll(async () => { await env?.cleanup(); });
beforeEach(async () => { await env.clearFirestore(); });

// ---------- helpers ----------
const now = () => Timestamp.now();
const as = (uid: string, claims: Record<string, unknown> = {}) =>
  env.authenticatedContext(uid, { email: `${uid}@example.com`, ...claims }).firestore();
const anon = () => env.unauthenticatedContext().firestore();
const seed = (fn: (db: any) => Promise<unknown>) =>
  env.withSecurityRulesDisabled(async (ctx) => { await fn(ctx.firestore()); });

const userDoc = (uid: string, extra: Record<string, unknown> = {}) => ({
  uid, email: `${uid}@example.com`, username: uid, createdAt: now(), rewardsPoints: 10, isWorker: false, ...extra,
});
const seedUser = (uid: string, extra: Record<string, unknown> = {}) =>
  seed((db) => setDoc(doc(db, 'users', uid), userDoc(uid, extra)));

// ================= USERS =================
describe('users', () => {
  it('blocks anonymous reads', async () => {
    await seedUser('alice');
    await assertFails(getDoc(doc(anon(), 'users', 'alice')));
  });

  it('lets a signed-in user get one profile but not list the collection', async () => {
    await seedUser('alice');
    await assertSucceeds(getDoc(doc(as('bob'), 'users', 'alice')));
    await assertFails(getDocs(collection(as('bob'), 'users')));
  });

  it('lets an admin list users', async () => {
    await seedUser('alice');
    await assertSucceeds(getDocs(collection(as('root', { admin: true }), 'users')));
  });

  it('creates your own plain profile', async () => {
    await assertSucceeds(setDoc(doc(as('alice'), 'users', 'alice'), {
      uid: 'alice', email: 'alice@example.com', username: 'alice',
      createdAt: serverTimestamp(), rewardsPoints: 0, isWorker: false,
    }));
  });

  it('blocks creating a profile with forged trust fields', async () => {
    const base = { uid: 'alice', email: 'alice@example.com', username: 'alice', createdAt: serverTimestamp() };
    await assertFails(setDoc(doc(as('alice'), 'users', 'alice'), { ...base, rating: 5 }));
    await assertFails(setDoc(doc(as('alice'), 'users', 'alice'), { ...base, verificationStatus: 'verified' }));
    await assertFails(setDoc(doc(as('alice'), 'users', 'alice'), { ...base, isPremiumWorker: true }));
  });

  it("blocks creating someone else's profile", async () => {
    await assertFails(setDoc(doc(as('mallory'), 'users', 'alice'), {
      uid: 'alice', email: 'alice@example.com', username: 'alice', createdAt: serverTimestamp(),
    }));
  });

  it('allows normal self-edits', async () => {
    await seedUser('alice');
    const ref = doc(as('alice'), 'users', 'alice');
    await assertSucceeds(updateDoc(ref, { bio: 'Plumber in Leeds' }));
    await assertSucceeds(updateDoc(ref, { workHistory: [], certifications: [] }));
  });

  it('blocks self-edits of trust and money fields', async () => {
    await seedUser('alice');
    const ref = doc(as('alice'), 'users', 'alice');
    await assertFails(updateDoc(ref, { rating: 5 }));
    await assertFails(updateDoc(ref, { reviewCount: 999 }));
    await assertFails(updateDoc(ref, { isPremiumWorker: true }));
    await assertFails(updateDoc(ref, { featured: true }));
    await assertFails(updateDoc(ref, { discountBalance: 100 }));
    await assertFails(updateDoc(ref, { verificationStatus: 'verified' }));
  });

  it('bounds reward point changes', async () => {
    await seedUser('alice', { rewardsPoints: 10 });
    const ref = doc(as('alice'), 'users', 'alice');
    await assertSucceeds(updateDoc(ref, { rewardsPoints: 40 }));
    await assertFails(updateDoc(ref, { rewardsPoints: 5000 }));
  });

  it('allows loginCount to go up by exactly one', async () => {
    await seedUser('alice');
    const ref = doc(as('alice'), 'users', 'alice');
    await assertSucceeds(updateDoc(ref, { loginCount: increment(1) }));
    await assertFails(updateDoc(ref, { loginCount: increment(50) }));
  });

  it("blocks editing someone else's profile", async () => {
    await seedUser('alice');
    await assertFails(updateDoc(doc(as('mallory'), 'users', 'alice'), { bio: 'pwned' }));
  });

  it('never lets a user be verified by themselves but allows an admin', async () => {
    await seedUser('alice');
    await assertSucceeds(updateDoc(doc(as('root', { admin: true }), 'users', 'alice'), { verificationStatus: 'verified' }));
  });
});

// ================= LOGIN INDEX =================
describe('login_index', () => {
  const entry = (uid: string) => ({ uid, email: `${uid}@example.com`, username: uid });

  it('allows an anonymous single lookup but not listing', async () => {
    await seed((db) => setDoc(doc(db, 'login_index', 'u_alice'), entry('alice')));
    await assertSucceeds(getDoc(doc(anon(), 'login_index', 'u_alice')));
    await assertFails(getDocs(collection(anon(), 'login_index')));
  });

  it('lets you publish your own key only with your own email', async () => {
    await assertSucceeds(setDoc(doc(as('alice'), 'login_index', 'u_alice'), entry('alice')));
    await assertFails(setDoc(doc(as('alice'), 'login_index', 'u_x'), { ...entry('alice'), email: 'victim@example.com' }));
  });

  it("blocks taking over someone else's key", async () => {
    await seed((db) => setDoc(doc(db, 'login_index', 'u_bob'), entry('bob')));
    await assertFails(setDoc(doc(as('alice'), 'login_index', 'u_bob'), entry('alice')));
  });
});

// ================= PUBLIC PROFILES =================
describe('public_profiles', () => {
  it('lets a worker publish their safe profile', async () => {
    await seedUser('alice', { isWorker: true });
    await assertSucceeds(setDoc(doc(as('alice'), 'public_profiles', 'alice'), {
      uid: 'alice', username: 'alice', isWorker: true, hourlyRate: 30, updatedAt: serverTimestamp(),
    }));
  });

  it('blocks forging a rating or verified badge in the directory', async () => {
    await seedUser('alice', { isWorker: true });
    const ref = doc(as('alice'), 'public_profiles', 'alice');
    await assertFails(setDoc(ref, { uid: 'alice', username: 'alice', isWorker: true, rating: 5 }));
    await assertFails(setDoc(ref, { uid: 'alice', username: 'alice', isWorker: true, verificationStatus: 'verified' }));
  });

  it('accepts a rating that matches the real profile', async () => {
    await seedUser('alice', { isWorker: true, rating: 4.5, reviewCount: 3 });
    await assertSucceeds(setDoc(doc(as('alice'), 'public_profiles', 'alice'), {
      uid: 'alice', username: 'alice', isWorker: true, rating: 4.5, reviewCount: 3,
    }));
  });

  it('only allows bounded directory queries', async () => {
    await assertSucceeds(getDocs(query(collection(as('bob'), 'public_profiles'), where('isWorker', '==', true), limit(50))));
    await assertFails(getDocs(query(collection(as('bob'), 'public_profiles'), where('isWorker', '==', true), limit(500))));
  });
});

// ================= BOOKINGS =================
describe('bookings', () => {
  const booking = () => ({ customerId: 'alice', serviceType: 'cleaning', status: 'pending', createdAt: now() });
  beforeEach(async () => {
    await seedUser('alice');
    await seedUser('bob', { isWorker: true });
    await seedUser('carol');
    await seed((db) => setDoc(doc(db, 'bookings', 'b1'), booking()));
  });

  it('lets the customer and any worker read, but not other customers', async () => {
    await assertSucceeds(getDoc(doc(as('alice'), 'bookings', 'b1')));
    await assertSucceeds(getDoc(doc(as('bob'), 'bookings', 'b1')));
    await assertFails(getDoc(doc(as('carol'), 'bookings', 'b1')));
  });

  it('blocks a non-worker from listing all bookings', async () => {
    await assertFails(getDocs(collection(as('carol'), 'bookings')));
    await assertSucceeds(getDocs(query(collection(as('alice'), 'bookings'), where('customerId', '==', 'alice'))));
  });

  it('lets a customer create only their own booking', async () => {
    await assertSucceeds(addDoc(collection(as('alice'), 'bookings'), { ...booking(), createdAt: serverTimestamp() }));
    await assertFails(addDoc(collection(as('alice'), 'bookings'), { ...booking(), customerId: 'carol', createdAt: serverTimestamp() }));
  });

  it('lets a worker claim an unassigned job as themselves', async () => {
    await assertSucceeds(updateDoc(doc(as('bob'), 'bookings', 'b1'), { workerId: 'bob', status: 'accepted', updatedAt: serverTimestamp() }));
  });

  it('blocks non-workers and impersonation when claiming', async () => {
    await assertFails(updateDoc(doc(as('carol'), 'bookings', 'b1'), { workerId: 'carol', status: 'accepted' }));
    await assertFails(updateDoc(doc(as('bob'), 'bookings', 'b1'), { workerId: 'carol', status: 'accepted' }));
  });

  it('blocks a worker from rewriting owner or price fields', async () => {
    await assertFails(updateDoc(doc(as('bob'), 'bookings', 'b1'), { customerId: 'bob' }));
    await assertFails(updateDoc(doc(as('bob'), 'bookings', 'b1'), { workerId: 'bob', status: 'accepted', price: 1 }));
  });

  it('lets the customer reschedule and cancel', async () => {
    const ref = doc(as('alice'), 'bookings', 'b1');
    await assertSucceeds(updateDoc(ref, { createdAt: '2026-12-01T10:00:00.000Z', status: 'negotiating' }));
    await assertSucceeds(updateDoc(ref, { status: 'cancelled' }));
  });

  it('blocks a customer from changing who owns the booking', async () => {
    await assertFails(updateDoc(doc(as('alice'), 'bookings', 'b1'), { customerId: 'carol' }));
  });

  it("blocks a second worker taking an already-assigned job", async () => {
    await seedUser('dave', { isWorker: true });
    await seed((db) => updateDoc(doc(db, 'bookings', 'b1'), { workerId: 'bob', status: 'accepted' }));
    await assertFails(updateDoc(doc(as('dave'), 'bookings', 'b1'), { workerId: 'dave', status: 'accepted' }));
  });
});

// ================= ITEMS & OFFERS =================
describe('offers', () => {
  beforeEach(async () => {
    await seed((db) => setDoc(doc(db, 'items', 'i1'), {
      sellerId: 'seller', title: 'Bike', price: 100, isFree: false, status: 'available', createdAt: now(),
    }));
  });
  const offer = (over: Record<string, unknown> = {}) => ({
    itemId: 'i1', sellerId: 'seller', buyerId: 'buyer', offerPrice: 80, status: 'pending', createdAt: serverTimestamp(), ...over,
  });

  it('lets a buyer make a correct offer', async () => {
    await assertSucceeds(addDoc(collection(as('buyer'), 'offers'), offer()));
  });

  it('blocks a wrong sellerId, a self-offer and a pre-accepted offer', async () => {
    await assertFails(addDoc(collection(as('buyer'), 'offers'), offer({ sellerId: 'someoneelse' })));
    await assertFails(addDoc(collection(as('seller'), 'offers'), offer({ buyerId: 'seller' })));
    await assertFails(addDoc(collection(as('buyer'), 'offers'), offer({ status: 'accepted' })));
  });

  it('only lets the seller accept; the buyer can only withdraw', async () => {
    await seed((db) => setDoc(doc(db, 'offers', 'o1'), { ...offer(), createdAt: now() }));
    await assertFails(updateDoc(doc(as('buyer'), 'offers', 'o1'), { status: 'accepted' }));
    await assertSucceeds(updateDoc(doc(as('seller'), 'offers', 'o1'), { status: 'accepted' }));
    await assertSucceeds(updateDoc(doc(as('buyer'), 'offers', 'o1'), { status: 'rejected' }));
  });

  it('keeps offers private to the two parties', async () => {
    await seed((db) => setDoc(doc(db, 'offers', 'o1'), { ...offer(), createdAt: now() }));
    await assertSucceeds(getDoc(doc(as('buyer'), 'offers', 'o1')));
    await assertFails(getDoc(doc(as('nosy'), 'offers', 'o1')));
  });
});

describe('items', () => {
  const item = () => ({ sellerId: 'seller', title: 'Bike', price: 100, isFree: false, status: 'available', createdAt: now() });
  it('lets only the seller edit and blocks reassigning ownership', async () => {
    await seed((db) => setDoc(doc(db, 'items', 'i1'), item()));
    await assertSucceeds(updateDoc(doc(as('seller'), 'items', 'i1'), { price: 90, updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(as('seller'), 'items', 'i1'), { sellerId: 'thief' }));
    await assertFails(updateDoc(doc(as('thief'), 'items', 'i1'), { price: 1 }));
  });
});

// ================= REVIEWS =================
describe('reviews', () => {
  const review = (over: Record<string, unknown> = {}) => ({
    userId: 'alice', rating: 5, comment: 'Great', providerId: 'bob', reviewerName: 'Alice', createdAt: serverTimestamp(), ...over,
  });
  it('accepts a valid review', async () => {
    await assertSucceeds(addDoc(collection(as('alice'), 'reviews'), review()));
  });
  it('rejects missing/forged author, bad ratings and self-reviews', async () => {
    const { userId, ...noUser } = review();
    void userId;
    await assertFails(addDoc(collection(as('alice'), 'reviews'), noUser));
    await assertFails(addDoc(collection(as('alice'), 'reviews'), review({ userId: 'carol' })));
    await assertFails(addDoc(collection(as('alice'), 'reviews'), review({ rating: 6 })));
    await assertFails(addDoc(collection(as('alice'), 'reviews'), review({ providerId: 'alice' })));
  });
});

// ================= PRIVATE & ADMIN DATA =================
describe('private data', () => {
  it('keeps contractor CRM and HMRC logs private to their owner', async () => {
    await assertSucceeds(addDoc(collection(as('alice'), 'contractor_crm'), { contractorId: 'alice', clientName: 'X' }));
    await assertSucceeds(addDoc(collection(as('alice'), 'hmrc_logs'), { workerId: 'alice', type: 'receipt', amount: 5 }));
    await assertFails(addDoc(collection(as('mallory'), 'hmrc_logs'), { workerId: 'alice', type: 'receipt', amount: 5 }));

    await seed((db) => setDoc(doc(db, 'hmrc_logs', 'h1'), { workerId: 'alice', amount: 5 }));
    await seed((db) => setDoc(doc(db, 'contractor_crm', 'c1'), { contractorId: 'alice' }));
    await assertFails(getDoc(doc(as('mallory'), 'hmrc_logs', 'h1')));
    await assertFails(getDoc(doc(as('mallory'), 'contractor_crm', 'c1')));
    await assertSucceeds(getDoc(doc(as('alice'), 'hmrc_logs', 'h1')));
  });

  it('keeps audit logs append-only and admin-readable', async () => {
    await assertSucceeds(addDoc(collection(as('alice'), 'audit_logs'), { action: 'x', timestamp: serverTimestamp() }));
    await seed((db) => setDoc(doc(db, 'audit_logs', 'a1'), { action: 'x' }));
    await assertFails(getDoc(doc(as('alice'), 'audit_logs', 'a1')));
    await assertFails(updateDoc(doc(as('alice'), 'audit_logs', 'a1'), { action: 'edited' }));
    await assertFails(deleteDoc(doc(as('alice'), 'audit_logs', 'a1')));
    await assertSucceeds(getDoc(doc(as('root', { admin: true }), 'audit_logs', 'a1')));
  });

  it('locks collections no client uses', async () => {
    await assertFails(getDocs(collection(as('alice'), 'crm_clients')));
    await assertFails(addDoc(collection(as('alice'), 'ledgers'), { x: 1 }));
    await assertFails(addDoc(collection(as('alice'), 'rentals'), { x: 1 }));
  });

  it('requires sign-in and ownership for SOS and feedback', async () => {
    await assertFails(addDoc(collection(anon(), 'sos_alerts'), { userId: 'guest-anon', message: 'help' }));
    await assertSucceeds(addDoc(collection(as('alice'), 'sos_alerts'), { userId: 'alice', message: 'help' }));
    await assertFails(addDoc(collection(as('alice'), 'sos_alerts'), { userId: 'bob', message: 'help' }));
    await assertSucceeds(addDoc(collection(as('alice'), 'feedback'), { userId: 'alice', subject: 'bug' }));
    await seed((db) => setDoc(doc(db, 'feedback', 'f1'), { userId: 'alice' }));
    await assertFails(getDoc(doc(as('alice'), 'feedback', 'f1')));
  });
});

// ================= COMMUNITY =================
describe('community', () => {
  beforeEach(async () => {
    await seed((db) => setDoc(doc(db, 'discussions', 'd1'), {
      title: 'Hi', content: 'Hello', authorId: 'alice', reactions: 0, replies: [], createdAt: now(),
    }));
    await seed((db) => setDoc(doc(db, 'community_pulse', 'p1'), {
      title: 'Clean-up', supportersCount: 1, rsvpedUsers: [], createdAt: now(),
    }));
  });

  it('allows one reaction or one reply at a time, nothing else', async () => {
    const ref = doc(as('bob'), 'discussions', 'd1');
    await assertSucceeds(updateDoc(ref, { reactions: 1 }));
    await assertSucceeds(updateDoc(ref, { replies: arrayUnion({ text: 'nice' }) }));
    await assertFails(updateDoc(doc(as('bob'), 'discussions', 'd1'), { reactions: 500 }));
    await assertFails(updateDoc(doc(as('bob'), 'discussions', 'd1'), { title: 'defaced' }));
  });

  it('allows +1 support and own RSVP only', async () => {
    const ref = doc(as('bob'), 'community_pulse', 'p1');
    await assertSucceeds(updateDoc(ref, { supportersCount: increment(1) }));
    await assertFails(updateDoc(ref, { supportersCount: increment(100) }));
    await assertSucceeds(updateDoc(ref, { rsvpedUsers: ['bob'] }));
    await assertFails(updateDoc(ref, { rsvpedUsers: ['a', 'b', 'c', 'd'] }));
  });

  it('validates volunteer hours and admin-only approval', async () => {
    const entry = (over: Record<string, unknown> = {}) => ({
      userId: 'alice', charityName: 'Food bank', hours: 3, note: '', status: 'pending', createdAt: serverTimestamp(), ...over,
    });
    await assertSucceeds(addDoc(collection(as('alice'), 'volunteer_hours'), entry()));
    await assertFails(addDoc(collection(as('alice'), 'volunteer_hours'), entry({ hours: 99 })));
    await assertFails(addDoc(collection(as('alice'), 'volunteer_hours'), entry({ status: 'approved' })));
    await assertFails(addDoc(collection(as('alice'), 'volunteer_hours'), entry({ userId: 'bob' })));
    await seed((db) => setDoc(doc(db, 'volunteer_hours', 'v1'), { ...entry(), createdAt: now() }));
    await assertFails(updateDoc(doc(as('alice'), 'volunteer_hours', 'v1'), { status: 'approved' }));
    await assertSucceeds(updateDoc(doc(as('root', { admin: true }), 'volunteer_hours', 'v1'), { status: 'approved' }));
  });
});
