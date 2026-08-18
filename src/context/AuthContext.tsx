import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  auth,
  googleProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  testFirestoreConnection,
  FirebaseUser
} from '../firebase';
import {
  syncUserProfileToFirestore,
  uploadLocalDbToFirestore,
  downloadFirestoreToLocalDb,
  subscribeToFirestoreCollections
} from '../services/firestoreSync';

export interface UserProfile {
  id?: string;
  name: string;
  username: string;
  email?: string;
  imageUrl?: string;
  password?: string;
  createdAt?: string;
  isFirebase?: boolean;
}

const DEFAULT_ADMIN: UserProfile = {
  name: 'System Administrator',
  username: 'admin',
  password: 'password',
  imageUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Admin',
  createdAt: new Date().toISOString()
};

interface AuthContextType {
  user: UserProfile | null;
  firebaseUser: FirebaseUser | null;
  profiles: UserProfile[];
  login: (username: string, password: string) => { success: boolean; error?: string };
  register: (data: { name: string; username: string; password: string; imageUrl?: string }) => { success: boolean; error?: string };
  signInWithGoogle: () => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  isSyncing: boolean;
  syncToCloud: () => Promise<boolean>;
  syncFromCloud: () => Promise<boolean>;
  lastSyncedAt: number | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(() => {
    const saved = localStorage.getItem('assembly_last_synced_at');
    return saved ? parseInt(saved, 10) : null;
  });

  const [profiles, setProfiles] = useState<UserProfile[]>(() => {
    try {
      const savedProfiles = localStorage.getItem('assembly_manager_profiles');
      if (savedProfiles) {
        const parsed: UserProfile[] = JSON.parse(savedProfiles);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Error loading stored profiles', e);
    }
    return [DEFAULT_ADMIN];
  });

  const [user, setUser] = useState<UserProfile | null>(() => {
    try {
      const savedUsername = localStorage.getItem('niyamasabha_user_id');
      if (savedUsername) {
        const savedProfiles = localStorage.getItem('assembly_manager_profiles');
        const list: UserProfile[] = savedProfiles ? JSON.parse(savedProfiles) : [DEFAULT_ADMIN];
        const match = list.find(p => p.username.toLowerCase() === savedUsername.toLowerCase());
        if (match) return match;
        if (savedUsername.toLowerCase() === 'admin') return DEFAULT_ADMIN;
      }
    } catch (e) {
      console.error('Error restoring session', e);
    }
    return null;
  });

  // Test Firestore connection on boot
  useEffect(() => {
    testFirestoreConnection();
  }, []);

  // Listen to Firebase Auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);
      if (fbUser) {
        const profile: UserProfile = {
          id: fbUser.uid,
          name: fbUser.displayName || fbUser.email?.split('@')[0] || 'Google User',
          username: fbUser.email ? fbUser.email.split('@')[0] : `user_${fbUser.uid.slice(0, 5)}`,
          email: fbUser.email || '',
          imageUrl: fbUser.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${fbUser.uid}`,
          createdAt: new Date().toISOString(),
          isFirebase: true
        };

        setUser(profile);
        localStorage.setItem('niyamasabha_user_id', profile.username);

        // Sync profile to Firestore
        try {
          await syncUserProfileToFirestore({
            id: fbUser.uid,
            email: fbUser.email || '',
            displayName: profile.name,
            photoURL: profile.imageUrl
          });
        } catch (err) {
          console.warn('Could not sync user profile to Firestore:', err);
        }

        // Setup realtime subscription
        const unsubSync = subscribeToFirestoreCollections();
        return () => unsubSync();
      }
    });

    return () => unsubscribe();
  }, []);

  // Keep profiles in localStorage
  useEffect(() => {
    localStorage.setItem('assembly_manager_profiles', JSON.stringify(profiles));
  }, [profiles]);

  // Google Sign-In with Firebase Auth
  const signInWithGoogle = async (): Promise<{ success: boolean; error?: string }> => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const fbUser = result.user;

      const profile: UserProfile = {
        id: fbUser.uid,
        name: fbUser.displayName || fbUser.email?.split('@')[0] || 'Google User',
        username: fbUser.email ? fbUser.email.split('@')[0] : `user_${fbUser.uid.slice(0, 5)}`,
        email: fbUser.email || '',
        imageUrl: fbUser.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${fbUser.uid}`,
        createdAt: new Date().toISOString(),
        isFirebase: true
      };

      // Add to local profiles list if not existing
      setProfiles(prev => {
        const filtered = prev.filter(p => p.username !== profile.username);
        return [...filtered, profile];
      });

      setUser(profile);
      localStorage.setItem('niyamasabha_user_id', profile.username);

      // Sync user profile to Firestore
      await syncUserProfileToFirestore({
        id: fbUser.uid,
        email: fbUser.email || '',
        displayName: profile.name,
        photoURL: profile.imageUrl
      });

      return { success: true };
    } catch (err: any) {
      console.error('Google Sign-In failed:', err);
      return { success: false, error: err?.message || 'Google Sign-In failed' };
    }
  };

  const login = (usernameInput: string, passwordInput: string) => {
    const username = usernameInput.trim();
    const password = passwordInput.trim();

    if (!username) {
      return { success: false, error: 'Username is required' };
    }
    if (!password) {
      return { success: false, error: 'Password is required' };
    }

    const matchedProfile = profiles.find(
      (p) => p.username.toLowerCase() === username.toLowerCase()
    );

    if (!matchedProfile) {
      return { success: false, error: 'User profile not found. Please register or sign in with Google.' };
    }

    if (matchedProfile.password && matchedProfile.password !== password) {
      return { success: false, error: 'Incorrect password' };
    }

    localStorage.setItem('niyamasabha_user_id', matchedProfile.username);
    setUser(matchedProfile);
    return { success: true };
  };

  const register = (data: { name: string; username: string; password: string; imageUrl?: string }) => {
    const trimmedName = data.name.trim();
    const trimmedUsername = data.username.trim().toLowerCase();
    const trimmedPassword = data.password.trim();

    if (!trimmedName) {
      return { success: false, error: 'Full name is required' };
    }
    if (!trimmedUsername) {
      return { success: false, error: 'Username is required' };
    }
    if (!trimmedPassword) {
      return { success: false, error: 'Password is required' };
    }

    const existing = profiles.find((p) => p.username.toLowerCase() === trimmedUsername);
    if (existing) {
      return { success: false, error: 'Username is already taken. Please choose another.' };
    }

    const newProfile: UserProfile = {
      name: trimmedName,
      username: trimmedUsername,
      password: trimmedPassword,
      imageUrl: data.imageUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(trimmedUsername)}`,
      createdAt: new Date().toISOString()
    };

    const updatedProfiles = [...profiles, newProfile];
    setProfiles(updatedProfiles);
    localStorage.setItem('assembly_manager_profiles', JSON.stringify(updatedProfiles));
    localStorage.setItem('niyamasabha_user_id', newProfile.username);
    setUser(newProfile);

    return { success: true };
  };

  const logout = async () => {
    try {
      if (auth.currentUser) {
        await firebaseSignOut(auth);
      }
    } catch (e) {
      console.warn('SignOut error:', e);
    }
    localStorage.removeItem('niyamasabha_user_id');
    setUser(null);
    setFirebaseUser(null);
  };

  // Cloud Sync Utilities
  const syncToCloud = async (): Promise<boolean> => {
    setIsSyncing(true);
    try {
      await uploadLocalDbToFirestore();
      const now = Date.now();
      setLastSyncedAt(now);
      localStorage.setItem('assembly_last_synced_at', now.toString());
      return true;
    } catch (e) {
      console.error('Cloud upload sync error:', e);
      return false;
    } finally {
      setIsSyncing(false);
    }
  };

  const syncFromCloud = async (): Promise<boolean> => {
    setIsSyncing(true);
    try {
      await downloadFirestoreToLocalDb();
      const now = Date.now();
      setLastSyncedAt(now);
      localStorage.setItem('assembly_last_synced_at', now.toString());
      return true;
    } catch (e) {
      console.error('Cloud download sync error:', e);
      return false;
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        firebaseUser,
        profiles,
        login,
        register,
        signInWithGoogle,
        logout,
        isSyncing,
        syncToCloud,
        syncFromCloud,
        lastSyncedAt
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
