import React, { createContext, useContext, useState, useEffect } from 'react';

export interface UserProfile {
  name: string;
  username: string;
  imageUrl?: string;
  password?: string;
  createdAt?: string;
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
  profiles: UserProfile[];
  login: (username: string, password: string) => { success: boolean; error?: string };
  register: (data: { name: string; username: string; password: string; imageUrl?: string }) => { success: boolean; error?: string };
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
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

  // Keep profiles in localStorage
  useEffect(() => {
    localStorage.setItem('assembly_manager_profiles', JSON.stringify(profiles));
  }, [profiles]);

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
      return { success: false, error: 'User profile not found. Please register first.' };
    }

    if (matchedProfile.password !== password) {
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

  const logout = () => {
    localStorage.removeItem('niyamasabha_user_id');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, profiles, login, register, logout }}>
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
