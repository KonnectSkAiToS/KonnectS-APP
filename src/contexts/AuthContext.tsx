/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User, signInWithPopup, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail, OAuthProvider } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, onSnapshot, query, collection, where, getDocs } from 'firebase/firestore';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from '../lib/firebase';
import { UserProfile } from '../types';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: (provider?: 'google' | 'apple' | 'microsoft') => Promise<void>;
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

  useEffect(() => {
    let unsubscribeProfile: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      
      if (user) {
        // Initial check to create profile if it doesn't exist
        const docRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(docRef);
        
        if (!docSnap.exists()) {
          try {
            const newProfile: UserProfile = {
              uid: user.uid,
              email: user.email || '',
              username: user.displayName || user.email?.split('@')[0] || 'User',
              rewardsPoints: 120,
              referralCode: Math.random().toString(36).substring(7).toUpperCase(),
              isWorker: false,
              carbonSavingsKg: 17.5,
              earnedBadges: ['pioneer'],
              createdAt: serverTimestamp(),
            };
            await setDoc(docRef, newProfile);
          } catch (error) {
            handleFirestoreError(error, OperationType.CREATE, `users/${user.uid}`);
          }
        }

        // Pre-populate with cached profile from localStorage immediately for offline speed / fallback
        const cachedProfile = localStorage.getItem(`konnects_profile_cache_${user.uid}`);
        if (cachedProfile) {
          setProfile(JSON.parse(cachedProfile));
        } else {
          fetch('/api/offline/profile')
            .then(res => res.json())
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
            setProfile(JSON.parse(cachedProfileBackup));
          } else {
            // Service Worker cache network-fallback recovery
            fetch('/api/offline/profile')
              .then(res => res.json())
              .then(data => {
                if (data && data.uid === user.uid) {
                  setProfile(data);
                }
              }).catch(() => {});
          }
        });

      } else {
        setProfile(null);
        if (unsubscribeProfile) unsubscribeProfile();
      }
      setLoading(false);
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, []);

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
            rewardsPoints: 120,
            referralCode: Math.random().toString(36).substring(7).toUpperCase(),
            isWorker: false,
            carbonSavingsKg: 17.5,
            earnedBadges: ['pioneer'],
            createdAt: serverTimestamp(),
          };
          await setDoc(docRef, newProfile);
        } catch (error) {
          handleFirestoreError(error, OperationType.CREATE, `users/${user.uid}`);
        }
      }
    } catch (error: any) {
      // The view handles the error display
      throw error;
    }
  };

  const emailSignIn = async (identifier: string, pass: string) => {
    try {
      let resolvedEmail = identifier.trim();
      
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
      
      await signInWithEmailAndPassword(auth, resolvedEmail, pass);
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

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error: any) {
      // Logout errors are rare but should be handled gracefully
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, emailSignIn, emailSignUp, resetPassword, logout }}>
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
