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

// Helper to push user changes to Supabase
export async function syncProfileToSupabase(profileData: UserProfile) {
  if (!isSupabaseConfigured() || !supabase) return;
  try {
    const { error: upsertErr } = await supabase.from('users').upsert({
      uid: profileData.uid,
      email: profileData.email,
      username: profileData.username || 'User',
      rewards_points: Number(profileData.rewardsPoints || 0),
      carbon_savings_kg: Number(profileData.carbonSavingsKg || 0),
      is_worker: Boolean(profileData.isWorker),
      created_at: new Date().toISOString(),
      raw_data: profileData
    } as any);

    if (upsertErr) {
      console.warn('[Dual DB Sync] Supabase profile sync error:', upsertErr.message);
    } else {
      console.log('[Dual DB Sync] Supabase users table updated in real-time');
    }
  } catch (error) {
    console.warn('[Dual DB Sync] Supabase profile Sync exception:', error);
  }
}

// Dual Session authentications helper
export async function ensureDualAuthSession(email: string, uid: string) {
  if (!isSupabaseConfigured() || !supabase) return;
  const password = 'dualSecurePass_@@' + uid;
  try {
    // Attempt dual auth log in
    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    // If user does not exist yet, sign them up
    if (signInErr && (signInErr.message.includes('Invalid login credentials') || signInErr.message.includes('Email not confirmed') || signInErr.message.includes('not found') || signInErr.status === 400)) {
      const { error: signUpErr } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            uid,
            displayName: email.split('@')[0],
          }
        }
      });
      if (!signUpErr) {
        console.log('[Dual Auth] Seamlessly registered matching account on Supabase Auth platform.');
        // Sign in immediately
        await supabase.auth.signInWithPassword({ email, password });
      }
    } else if (!signInErr) {
      console.log('[Dual Auth] Authenticated flawlessly to Supabase Auth. Dual identities aligned.');
    }
  } catch (err) {
    console.warn('[Dual Auth] Non-blocking exception during dual-authentication routine:', err);
  }
}

// Local cache migration utility helper
export async function migrateLocalCacheToSupabase(uid: string) {
  if (!isSupabaseConfigured() || !supabase) return;
  const migrationDoneKey = `supabase_cache_migration_done_${uid}`;
  if (localStorage.getItem(migrationDoneKey) === 'true') return;

  console.log('[Migration System] First-time login detected. Migrating local cache to Supabase PostgreSQL...');
  
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
            user_id: uid,
            driver_name: ride.driverName || 'Cab Driver',
            status: ride.status || 'scheduled',
            price: Number(ride.price || 15.00),
            created_at: ride.createdAt || new Date().toISOString(),
            raw_data: ride
          } as any);
          if (error) console.warn('[Migration Warning] Sync scheduled ride failure:', error.message);
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
            user_id: uid,
            status: task.status || 'pending',
            price: Number(task.price || 25.0),
            created_at: task.createdAt || new Date().toISOString(),
            raw_data: task
          } as any);
          if (error) console.warn('[Migration Warning] Sync task booking failure:', error.message);
        }
      }
    }

    // Finished
    localStorage.setItem(migrationDoneKey, 'true');
    console.log('[Migration System] Hybrid database cache migration completed.');
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

  // Handle seamless dual auth session registration and automatic cache migration
  useEffect(() => {
    if (user) {
      ensureDualAuthSession(user.email || '', user.uid);
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
                const emailKey = (user.email || '').toLowerCase().trim();
                const mockFields = MOCK_PROFILES_MAP[emailKey] || {};
                
                const newProfile: UserProfile = {
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
                  rating: mockFields.rating,
                  reviewCount: mockFields.reviewCount,
                  bio: mockFields.bio,
                  mobileNumber: mockFields.mobileNumber || '',
                  rewardsPoints: 100,
                  referralCode: Math.random().toString(36).substring(7).toUpperCase(),
                  carbonSavingsKg: 0,
                  earnedBadges: [],
                  createdAt: serverTimestamp(),
                };
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
        unsubscribeProfile = onSnapshot(docRef, (snap) => {
          if (snap.exists()) {
            const profileData = snap.data() as UserProfile;
            setProfile(profileData);
            localStorage.setItem(`konnects_profile_cache_${user.uid}`, JSON.stringify(profileData));
            
            // Sync user profile data to Service Worker cache via API endpoint
            fetch('/api/offline/profile', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(profileData)
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
    const current = profile || DEFAULT_GUEST_PROFILE;
    const updated = { ...current, ...updates };
    setProfile(updated as UserProfile);

    const activeUid = profile?.uid || user?.uid;
    if (activeUid && activeUid !== 'guest-user') {
      localStorage.setItem(`konnects_profile_cache_${activeUid}`, JSON.stringify(updated));
      localStorage.setItem('konnects_guest_profile', JSON.stringify(updated));
      try {
        await setDoc(doc(db, 'users', activeUid), updates, { merge: true });
      } catch (err) {
        console.warn('[AuthContext] setDoc profile update notice:', err);
      }
    } else {
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
        await updateDoc(docRef, {
          loginCount: increment(1)
        });
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
    try {
      let resolvedEmail = identifier.trim().toLowerCase();
      
      // If identifier doesn't look like an email (doesn't contain '@'), try to resolve by username or mobileNumber
      if (!resolvedEmail.includes('@')) {
        const qUsername = query(collection(db, 'users'), where('username', '==', resolvedEmail));
        const snapUsername = await getDocs(qUsername);
        
        if (!snapUsername.empty) {
          resolvedEmail = snapUsername.docs[0].data().email;
        } else {
          // If no username found, try mobileNumber
          const qMobile = query(collection(db, 'users'), where('mobileNumber', '==', resolvedEmail));
          const snapMobile = await getDocs(qMobile);
          if (!snapMobile.empty) {
            resolvedEmail = snapMobile.docs[0].data().email;
          }
        }
      }
      
      // Check if it's one of the 5 demo accounts
      const isDemoAccount = [
        'alex.rivera@konnects.co.uk',
        'sarah.jenkins@konnects.co.uk',
        'marcus.thorne@konnects.co.uk',
        'elena.gilbert@konnects.co.uk',
        'david.okafor@konnects.co.uk'
      ].includes(resolvedEmail);

      if (isDemoAccount) {
        try {
          await signInWithEmailAndPassword(auth, resolvedEmail, pass);
        } catch (authErr: any) {
          // If user doesn't exist, register them on-the-fly and sign in!
          if (authErr.code === 'auth/user-not-found' || authErr.code === 'auth/invalid-credential' || authErr.code === 'auth/wrong-password') {
            await createUserWithEmailAndPassword(auth, resolvedEmail, pass);
          } else {
            throw authErr;
          }
        }
      } else {
        await signInWithEmailAndPassword(auth, resolvedEmail, pass);
      }
    } catch (error: any) {
      throw error;
    }
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
    const email = `${providerName.toLowerCase()}-tester@konnects.dev`;
    const pass = `${providerName.charAt(0).toUpperCase() + providerName.slice(1)}Tester123!`;
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
      await signOut(auth);
      setGoogleAccessToken(null);
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
