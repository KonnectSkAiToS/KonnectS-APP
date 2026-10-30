/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User, signInWithPopup, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail, OAuthProvider, GoogleAuthProvider } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, increment, serverTimestamp, onSnapshot, query, collection, where, getDocs } from 'firebase/firestore';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from '../lib/firebase';
import { UserProfile } from '../types';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { appendUserToGoogleSheets } from '../lib/sheetsService';
import { resolveLoginIdentifier, ensureLoginIndex } from '../lib/loginIndex';
import { ensurePublicProfile } from '../lib/publicProfile';
import { clearUserLocalData } from '../utils/indexedDB';

// Demo accounts / simulated logins are for development only. Enable explicitly in other builds.
const isDemoModeEnabled = () =>
  Boolean((import.meta as any).env?.DEV) || (import.meta as any).env?.VITE_ENABLE_DEMO_ACCOUNTS === 'true';
const isSimulatedLoginDisabled = () => (import.meta as any).env?.VITE_DISABLE_SIMULATED_LOGIN === 'true';

// Firestore rejects `undefined` field values, so drop them before writing.
function stripUndefined<T extends Record<string, any>>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;
}

// Per-device random credentials for the simulated/guest sign-in (no shared, guessable password).
function getSimulatedCredentials(provider: string): { email: string; pass: string } {
  const key = `konnects_sim_cred_${provider}`;
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.email && parsed?.pass) return parsed;
    }
  } catch { /* fall through and generate */ }
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  const rand = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  const creds = { email: `${provider}-${rand.slice(0, 10)}@konnects.dev`, pass: `Sim!${rand}` };
  try { localStorage.setItem(key, JSON.stringify(creds)); } catch { /* storage unavailable */ }
  return creds;
}

export const MOCK_PROFILES_MAP: Record<string, any> = {
  'alex.rivera@konnects.co.uk': {
    firstName: 'Alex',
    lastName: 'Rivera',
    fullName: 'Alex Rivera',
    username: 'alex_rivera',
    isWorker: true,
    isWorkerMode: true,
    workerType: 'electrician',
    hourlyRate: 55,
    rating: 4.9,
    reviewCount: 142,
    mobileNumber: '07700 900077',
    bio: 'Certified Master Electrician with 12+ years of experience across London. Specialising in emergency callouts, smart home installations, safety certifications, and commercial rewiring. DBS Checked.'
  },
  'sarah.jenkins@konnects.co.uk': {
    firstName: 'Sarah',
    lastName: 'Jenkins',
    fullName: 'Sarah Jenkins',
    username: 'sarah_jenkins',
    isWorker: true,
    isWorkerMode: true,
    workerType: 'other',
    hourlyRate: 22,
    rating: 4.8,
    reviewCount: 98,
    mobileNumber: '07700 900098',
    bio: 'Ofsted-registered Childcare Specialist and early-years tutor. Over 8 years of nurturing care, first-aid certified, and DBS clear. Providing premium babysitting, learning development plans, and emergency childcare.'
  },
  'marcus.thorne@konnects.co.uk': {
    firstName: 'Marcus',
    lastName: 'Thorne',
    fullName: 'Marcus Thorne',
    username: 'marcus_thorne',
    isWorker: true,
    isWorkerMode: true,
    workerType: 'cleaner',
    hourlyRate: 18,
    rating: 4.7,
    reviewCount: 215,
    mobileNumber: '07700 900142',
    bio: 'Eco-friendly Professional Cleaning Expert. 6+ years delivering spotless domestic, end-of-tenancy, and deep office sanitisation. Using 100% bio-degradable products. Fast, reliable, and insured.'
  },
  'elena.gilbert@konnects.co.uk': {
    firstName: 'Elena',
    lastName: 'Gilbert',
    fullName: 'Elena Gilbert',
    username: 'elena_gilbert',
    isWorker: true,
    isWorkerMode: true,
    workerType: 'cab_owner',
    hourlyRate: 15,
    rating: 4.9,
    reviewCount: 312,
    mobileNumber: '07700 900215',
    bio: 'Efficient, friendly Delivery & Logistics Partner. Covering London zones 1-4 with a private eco-vehicle. Specialising in fragile parcel transport, multi-stop business logistics, and instant local courier service.'
  },
  'david.okafor@konnects.co.uk': {
    firstName: 'David',
    lastName: 'Okafor',
    fullName: 'David Okafor',
    username: 'david_okafor',
    isWorker: true,
    isWorkerMode: true,
    workerType: 'other',
    hourlyRate: 30,
    rating: 4.8,
    reviewCount: 184,
    mobileNumber: '07700 900312',
    bio: 'Your trusted neighbourhood Handyman and Multi-Trader. Skilled in plumbing repairs, flatpack assembly, lock repairs, and minor painting/decorating. Quick 1-hour response. Fully insured.'
  }
};

// Helper to push user changes to Supabase (own profile only; sensitive fields are never mirrored)
const SENSITIVE_PROFILE_KEYS = ['documents', 'verificationPhoto', 'dateOfBirth', 'mobileNumber'];

export async function syncProfileToSupabase(profileData: UserProfile) {
  if (!isSupabaseConfigured() || !supabase) return;
  if (!profileData?.uid || profileData.uid === 'guest-user') return;
  try {
    const safeData: Record<string, any> = { ...profileData };
    for (const key of SENSITIVE_PROFILE_KEYS) delete safeData[key];

    // created_at is intentionally not sent: it keeps its original database default on upsert.
    const { error: upsertErr } = await supabase.from('users').upsert({
      uid: profileData.uid,
      email: profileData.email,
      username: profileData.username || 'User',
      rewards_points: Number(profileData.rewardsPoints || 0),
      carbon_savings_kg: Number(profileData.carbonSavingsKg || 0),
      is_worker: Boolean(profileData.isWorker),
      raw_data: safeData
    } as any);

    if (upsertErr) {
      console.warn('[Dual DB Sync] Supabase profile sync error:', upsertErr.message);
    }
  } catch (error) {
    console.warn('[Dual DB Sync] Supabase profile Sync exception:', error);
  }
}

// Local cache migration utility helper
export async function migrateLocalCacheToSupabase(uid: string) {
  if (!isSupabaseConfigured() || !supabase) return;
  const migrationDoneKey = `supabase_cache_migration_done_${uid}`;
  if (localStorage.getItem(migrationDoneKey) === 'true') return;

  console.log('[Migration System] First-time login detected. Migrating local cache to Supabase PostgreSQL...');
  let hadError = false;
  
  try {
    // 1. Assists & Rewards Points migration
    const assistCount = Number(localStorage.getItem('user_local_assists_count') || '16');
    const savedLaborCredits = Number(localStorage.getItem('saved_labor_credits') || '0');
    
    // 2. Scheduled Rides migration
    const localRidesRaw = localStorage.getItem('konnects_scheduled_rides');
    if (localRidesRaw) {
      const localRides = JSON.parse(localRidesRaw);
      if (Array.isArray(localRides) && localRides.length > 0) {
        for (const ride of localRides) {
          const { error } = await supabase.from('bookings').upsert({
            id: ride.id || `ride-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            service_type: 'ride-share',
            customer_id: uid,
            status: ride.status || 'scheduled',
            price: Number(ride.price || 15.00),
            created_at: ride.createdAt || new Date().toISOString(),
            raw_data: ride
          } as any);
          if (error) { hadError = true; console.warn('[Migration Warning] Sync scheduled ride failure:', error.message); }
        }
      }
    }

    // 3. Local task/service bookings cache migration
    const localTasksRaw = localStorage.getItem(`konnects_pending_tasks_cache_${uid}`);
    if (localTasksRaw) {
      const localTasks = JSON.parse(localTasksRaw);
      if (Array.isArray(localTasks) && localTasks.length > 0) {
        for (const task of localTasks) {
          const { error } = await supabase.from('bookings').upsert({
            id: task.id || `service-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            service_type: task.serviceType || 'verified-service',
            customer_id: uid,
            status: task.status || 'pending',
            price: Number(task.price || 25.0),
            created_at: task.createdAt || new Date().toISOString(),
            raw_data: task
          } as any);
          if (error) { hadError = true; console.warn('[Migration Warning] Sync task booking failure:', error.message); }
        }
      }
    }

    // Finished. Only remember completion if nothing failed, so a failed run is retried next time.
    if (!hadError) {
      localStorage.setItem(migrationDoneKey, 'true');
      console.log('[Migration System] Hybrid database cache migration completed.');
    } else {
      console.warn('[Migration System] Some records failed to migrate; will retry on next sign-in.');
    }
  } catch (err) {
    console.warn('[Migration System] Error in cache migration routine:', err);
  }
}

const DEFAULT_GUEST_PROFILE: UserProfile = {
  uid: 'guest-user',
  email: 'guest@konnects.dev',
  username: 'Guest Explorer',
  rewardsPoints: 50,
  referralCode: 'GUEST123',
  carbonSavingsKg: 0,
  earnedBadges: [],
  isWorker: true,
  isWorkerMode: false,
  createdAt: null,
};

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  googleAccessToken: string | null;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  toggleWorkerMode: () => Promise<void>;
  signIn: (provider?: 'google' | 'apple' | 'microsoft') => Promise<void>;
  simulateOAuthSignIn: (providerName: string) => Promise<void>;
  emailSignIn: (email: string, pass: string) => Promise<void>;
  emailSignUp: (data: Partial<UserProfile>, pass: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(null);

  // Sync profile details to Supabase upon any local update or change
  useEffect(() => {
    if (profile) {
      syncProfileToSupabase(profile);
    }
  }, [profile]);

  // Automatic cache migration (Supabase authenticates with the Firebase ID token; no second password)
  useEffect(() => {
    if (user) {
      migrateLocalCacheToSupabase(user.uid);
    }
  }, [user]);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      
      if (user) {
        const docRef = doc(db, 'users', user.uid);
        
        // Run the profile check and mock creation asynchronously to prevent blocking the initial app load sequence when offline or unconfigured
        (async () => {
          try {
            const docSnap = await getDoc(docRef);
            
            if (!docSnap.exists()) {
              try {
                // Demo personas only exist in development / when explicitly enabled.
                const emailKey = (user.email || '').toLowerCase().trim();
                const mockFields = isDemoModeEnabled() ? (MOCK_PROFILES_MAP[emailKey] || {}) : {};

                // Trust fields (rating, reviewCount, verification) are never client-writable.
                const newProfile = stripUndefined({
                  uid: user.uid,
                  email: user.email || '',
                  username: mockFields.username || user.displayName || user.email?.split('@')[0] || 'User',
                  firstName: mockFields.firstName || '',
                  lastName: mockFields.lastName || '',
                  fullName: mockFields.fullName || `${user.displayName || 'User'}`.trim(),
                  isWorker: mockFields.isWorker || false,
                  isWorkerMode: mockFields.isWorkerMode || false,
                  workerType: mockFields.workerType,
                  hourlyRate: mockFields.hourlyRate,
                  bio: mockFields.bio,
                  mobileNumber: mockFields.mobileNumber || '',
                  rewardsPoints: 100,
                  referralCode: Math.random().toString(36).substring(7).toUpperCase(),
                  carbonSavingsKg: 0,
                  earnedBadges: [],
                  createdAt: serverTimestamp(),
                }) as unknown as UserProfile;
                await setDoc(docRef, newProfile);
              } catch (error) {
                console.warn("[AuthContext] Async profile auto-creation failed (possibly offline or read-only/rules block):", error);
              }
            }
          } catch (error) {
            console.warn("[AuthContext] Async Firestore getDoc check failed (possibly offline or unconfigured):", error);
          }
        })();

        // Pre-populate with cached profile from localStorage immediately for offline speed / fallback
        const cachedProfile = localStorage.getItem(`konnects_profile_cache_${user.uid}`);
        if (cachedProfile) {
          try {
            setProfile(JSON.parse(cachedProfile));
          } catch (err) {
            console.warn('[AuthContext] Failed to parse cached profile:', err);
          }
        } else {
          fetch('/api/offline/profile')
            .then(res => {
              if (!res.ok) return null;
              return res.json();
            })
            .then(data => {
              if (data && data.uid === user.uid) {
                setProfile(data);
              }
            }).catch(() => {});
        }

        // Set up real-time listener for profile
        let loginIndexed = false;
        unsubscribeProfile = onSnapshot(docRef, (snap) => {
          if (snap.exists()) {
            const profileData = snap.data() as UserProfile;
            setProfile(profileData);
            if (!loginIndexed) {
              loginIndexed = true;
              ensureLoginIndex(profileData as any);
            }
            ensurePublicProfile(profileData as any);
            localStorage.setItem(`konnects_profile_cache_${user.uid}`, JSON.stringify(profileData));
            
            // Sync user profile data to Service Worker cache via API endpoint
            fetch('/api/offline/profile', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify((() => { const { documents, verificationPhoto, dateOfBirth, ...rest } = profileData as any; return rest; })())
            }).catch(e => console.warn('Bypassed SW profile cache sync:', e));
          }
        }, (error) => {
          console.warn("Firestore snapshot failed (possibly offline). Using cached profile instead.", error);
          const cachedProfileBackup = localStorage.getItem(`konnects_profile_cache_${user.uid}`);
          if (cachedProfileBackup) {
            try {
              setProfile(JSON.parse(cachedProfileBackup));
            } catch (err) {
              console.warn('[AuthContext] Failed to parse cached backup profile:', err);
            }
          } else {
            // Service Worker cache network-fallback recovery
            fetch('/api/offline/profile')
              .then(res => {
                if (!res.ok) return null;
                return res.json();
              })
              .then(data => {
                if (data && data.uid === user.uid) {
                  setProfile(data);
                }
              }).catch(() => {});
          }
        });

      } else {
        if (unsubscribeProfile) unsubscribeProfile();
        const cachedGuest = localStorage.getItem('konnects_guest_profile');
        if (cachedGuest) {
          try {
            setProfile(JSON.parse(cachedGuest));
          } catch {
            setProfile(DEFAULT_GUEST_PROFILE);
          }
        } else {
          setProfile(DEFAULT_GUEST_PROFILE);
        }
      }
      setLoading(false);
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, []);

  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (user && profile?.uid && profile.uid !== 'guest-user') {
      const previous = profile;
      const updated = { ...profile, ...updates };
      setProfile(updated as UserProfile);
      localStorage.setItem(`konnects_profile_cache_${user.uid}`, JSON.stringify(updated));
      try {
        await setDoc(doc(db, 'users', user.uid), stripUndefined(updates as Record<string, any>), { merge: true });
        if ('username' in updates || 'mobileNumber' in updates) {
          ensureLoginIndex(updated as any);
        }
      } catch (err) {
        // The write was rejected (rules/offline). Roll the UI back so it never shows unsaved data as saved.
        console.warn('[AuthContext] Profile update failed; reverting local state:', err);
        setProfile(previous);
        localStorage.setItem(`konnects_profile_cache_${user.uid}`, JSON.stringify(previous));
      }
    } else {
      const current = profile || DEFAULT_GUEST_PROFILE;
      const updated = { ...current, ...updates };
      setProfile(updated as UserProfile);
      localStorage.setItem('konnects_guest_profile', JSON.stringify(updated));
    }
  };

  const toggleWorkerMode = async () => {
    const currentMode = !!profile?.isWorkerMode;
    const nextMode = !currentMode;
    await updateProfile({
      isWorkerMode: nextMode,
      isWorker: true,
      workerType: profile?.workerType || 'cleaner',
      updatedAt: serverTimestamp() as any
    });
  };

  const signIn = async (providerName: 'google' | 'apple' | 'microsoft' = 'google') => {
    try {
      let provider: any = googleProvider;
      if (providerName === 'apple') {
        provider = new OAuthProvider('apple.com');
      } else if (providerName === 'microsoft') {
        provider = new OAuthProvider('microsoft.com');
      }
      
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      
      // Ensure profile exists on sign in
      const docRef = doc(db, 'users', user.uid);
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) {
        try {
          const newProfile: UserProfile = {
            uid: user.uid,
            email: user.email || '',
            username: user.displayName || user.email?.split('@')[0] || 'User',
            rewardsPoints: 0,
            referralCode: Math.random().toString(36).substring(7).toUpperCase(),
            isWorker: false,
            carbonSavingsKg: 0,
            earnedBadges: [],
            loginCount: 1,
            createdAt: serverTimestamp(),
          };
          await setDoc(docRef, newProfile);
        } catch (error) {
          handleFirestoreError(error, OperationType.CREATE, `users/${user.uid}`);
        }
      } else {
        try {
          await updateDoc(docRef, {
            loginCount: increment(1)
          });
        } catch (countErr) {
          console.warn('[AuthContext] Could not bump loginCount (non-fatal):', countErr);
        }
      }

      if (providerName === 'google') {
        const credential = GoogleAuthProvider.credentialFromResult(result);
        const accessToken = credential?.accessToken;
        if (accessToken) {
          setGoogleAccessToken(accessToken);
          try {
            await appendUserToGoogleSheets(user, accessToken);
          } catch (sheetsErr) {
            console.warn('Failed to append user sign-up details to Google Sheets:', sheetsErr);
          }
        }
      }
    } catch (error: any) {
      // The view handles the error display
      throw error;
    }
  };

  const emailSignIn = async (identifier: string, pass: string) => {
    // Resolve username / mobile number to an email via the login index (single-document lookup).
    const resolvedEmail = (await resolveLoginIdentifier(identifier)) || identifier.trim().toLowerCase();

    const demoEmails = [
      'alex.rivera@konnects.co.uk',
      'sarah.jenkins@konnects.co.uk',
      'marcus.thorne@konnects.co.uk',
      'elena.gilbert@konnects.co.uk',
      'david.okafor@konnects.co.uk'
    ];

    // Demo personas are only auto-registered in development builds (or when explicitly enabled),
    // so nobody can claim a "verified-looking" demo identity on a production deployment.
    if (isDemoModeEnabled() && demoEmails.includes(resolvedEmail)) {
      try {
        await signInWithEmailAndPassword(auth, resolvedEmail, pass);
      } catch (authErr: any) {
        if (authErr.code === 'auth/user-not-found' || authErr.code === 'auth/invalid-credential' || authErr.code === 'auth/wrong-password') {
          try {
            await createUserWithEmailAndPassword(auth, resolvedEmail, pass);
          } catch (createErr: any) {
            // The account already exists, so the original failure was simply a wrong password.
            if (createErr?.code === 'auth/email-already-in-use') throw authErr;
            throw createErr;
          }
        } else {
          throw authErr;
        }
      }
      return;
    }

    await signInWithEmailAndPassword(auth, resolvedEmail, pass);
  };

  const emailSignUp = async (data: Partial<UserProfile>, pass: string) => {
    if (!data.email) return;
    try {
      const result = await createUserWithEmailAndPassword(auth, data.email, pass);
      const user = result.user;
      const docRef = doc(db, 'users', user.uid);
      
      const newProfile: UserProfile = {
        uid: user.uid,
        email: user.email || '',
        username: data.username || 'User',
        firstName: data.firstName || '',
        lastName: data.lastName || '',
        fullName: `${data.firstName || ''} ${data.lastName || ''}`.trim(),
        dateOfBirth: data.dateOfBirth || '',
        gender: data.gender || '',
        mobileNumber: data.mobileNumber || '',
        rewardsPoints: 0,
        carbonSavingsKg: 0,
        earnedBadges: [],
        referralCode: Math.random().toString(36).substring(7).toUpperCase(),
        isWorker: false,
        createdAt: serverTimestamp(),
      };
      try {
        await setDoc(docRef, newProfile);
        ensureLoginIndex(newProfile as any);
      } catch (firestoreError) {
        handleFirestoreError(firestoreError, OperationType.CREATE, `users/${user.uid}`);
      }
    } catch (error) {
      throw error;
    }
  };

  const resetPassword = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (error: any) {
      throw error;
    }
  };

  const simulateOAuthSignIn = async (providerName: string) => {
    if (isSimulatedLoginDisabled()) {
      throw new Error('Simulated sign-in is disabled in this build.');
    }
    // Unique random credentials per device: there is no shared, guessable "tester" password.
    const { email, pass } = getSimulatedCredentials(providerName.toLowerCase().replace(/[^a-z0-9]/g, '') || 'guest');
    const username = providerName.toLowerCase() === 'guest' ? 'Guest Explorer' : `${providerName.charAt(0).toUpperCase() + providerName.slice(1)} Tester`;
    
    try {
      let result;
      try {
        result = await signInWithEmailAndPassword(auth, email, pass);
      } catch (signInErr: any) {
        if (signInErr.code === 'auth/user-not-found' || signInErr.code === 'auth/invalid-credential' || signInErr.code === 'auth/wrong-password') {
          result = await createUserWithEmailAndPassword(auth, email, pass);
        } else {
          throw signInErr;
        }
      }
      
      const loggedUser = result.user;
      const docRef = doc(db, 'users', loggedUser.uid);
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) {
        const newProfile: UserProfile = {
          uid: loggedUser.uid,
          email: loggedUser.email || '',
          username: username,
          rewardsPoints: 50,
          carbonSavingsKg: 0,
          earnedBadges: [],
          referralCode: Math.random().toString(36).substring(7).toUpperCase(),
          isWorker: false,
          createdAt: serverTimestamp(),
        };
        try {
          await setDoc(docRef, newProfile);
        } catch (firestoreErr) {
          handleFirestoreError(firestoreErr, OperationType.CREATE, `users/${loggedUser.uid}`);
        }
      }
    } catch (error: any) {
      console.warn(`Simulation failed for ${providerName}:`, error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      const uid = auth.currentUser?.uid;
      await signOut(auth);
      setGoogleAccessToken(null);
      clearUserLocalData();
      if (uid) localStorage.removeItem(`konnects_profile_cache_${uid}`);
    } catch (error: any) {
      // Logout errors are rare but should be handled gracefully
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, googleAccessToken, updateProfile, toggleWorkerMode, signIn, simulateOAuthSignIn, emailSignIn, emailSignUp, resetPassword, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
