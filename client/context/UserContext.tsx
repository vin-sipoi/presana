"use client"

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react"
import { getLocalStorage, setLocalStorage, removeLocalStorage, getSessionStorage, STORAGE_KEYS } from "@/utils/storage"
import { useCurrentWallet } from "@mysten/dapp-kit"

type User = {
  id?: string
  name: string
  email: string
  bio?: string
  instagram?: string
  twitter?: string
  youtube?: string
  tiktok?: string
  linkedin?: string
  website?: string
  mobile?: string
  username?: string
  walletAddress?: string
  emails: { address: string; primary: boolean; verified: boolean }[]
  eventsAttended?: number
  poapsCollected?: number
  avatarUrl?: string
  picture?: string
  googleId?: string
  googleToken?: string
  jwt?: string
}

type UserContextType = {
  user: User | null
  setUser: React.Dispatch<React.SetStateAction<User | null>>
  login: (user: User) => void
  logout: () => void
  updateUserProfile: (updates: Partial<User>) => void
  updateProfileImage: (imageUrl: string) => void
  updateUserName: (name: string) => void
  updateUserEmail: (email: string) => void
}

const UserContext = createContext<UserContextType | undefined>(undefined)

export const UserProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Get wallet address from dapp-kit
  const { currentWallet } = useCurrentWallet();
  const address = currentWallet?.accounts?.[0]?.address;

  // Initialize user data from storage and session
  useEffect(() => {
    if (typeof window === 'undefined' || isInitialized) return;

    console.log('Initializing UserContext...');

    // First, try to get user data from session (from ZkLoginProvider)
    const sessionData = getSessionStorage<any>(STORAGE_KEYS.AUTH_SESSION);
    const localUserData = getLocalStorage<User>(STORAGE_KEYS.USER_DATA);

    let initialUser: User | null = null;

    if (sessionData?.user) {
      // Use session data as base (from Google login)
      initialUser = {
        name: sessionData.user.name || sessionData.user.given_name || "No Name",
        email: sessionData.user.email || "",
        username: sessionData.user.name || "Sui User",
        avatarUrl: sessionData.user.picture || "https://api.dicebear.com/7.x/avataaars/svg?seed=SuiLens",
        walletAddress: address || localUserData?.walletAddress,
        emails: sessionData.user.email ? [{ address: sessionData.user.email, primary: true, verified: true }] : [],
        jwt: sessionData.jwt,
        // Merge with any additional local data
        ...localUserData,
      };
      console.log('Initialized user from session data:', initialUser);
    } else if (localUserData) {
      // Fallback to local storage if no session
      initialUser = {
        ...localUserData,
        walletAddress: address || localUserData.walletAddress,
      };
      console.log('Initialized user from localStorage:', initialUser);
    } else if (address) {
      // Only wallet address available
      initialUser = {
        name: "No Name",
        email: "",
        username: "Sui User",
        avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=SuiLens",
        walletAddress: address,
        emails: [],
      };
      console.log('Initialized user with wallet address only:', initialUser);
    } else {
      // No session, no local data, no address - do not clear user here to avoid flicker
      console.log('No user data found to initialize');
      return;
    }

    setUser(initialUser);
    setIsInitialized(true);
  }, [address, isInitialized]);

  // Update wallet address when it changes
  useEffect(() => {
    if (!isInitialized || !address) return;

    setUser(prev => {
      if (!prev) {
        // Create new user with wallet address
        return {
          name: "No Name",
          email: "",
          username: "Sui User",
          avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=SuiLens",
          walletAddress: address,
          emails: [],
        };
      }

      if (prev.walletAddress !== address) {
        console.log('Updating wallet address:', address);
        return { ...prev, walletAddress: address };
      }

      return prev;
    });
  }, [address, isInitialized]);

  // Save to localStorage when user changes (but don't save walletAddress to avoid conflicts)
  useEffect(() => {
    if (!isInitialized || !user) return;

    // Save user data without walletAddress (walletAddress comes from session/Enoki)
    const userDataToSave = { ...user };
    delete userDataToSave.walletAddress;

    setLocalStorage(STORAGE_KEYS.USER_DATA, userDataToSave);
    console.log("User data saved to localStorage (without walletAddress):", userDataToSave);
  }, [user, isInitialized]);

  const updateUserProfile = (updates: Partial<User>) => {
    setUser(prev => prev ? { ...prev, ...updates } : null);
  };

  const updateProfileImage = (imageUrl: any) => {
    setUser(prev => prev ? { ...prev, avatarUrl: imageUrl } : null);
  };

  const updateUserName = (name: any) => {
    setUser(prev => prev ? { ...prev, name } : null);
  };

  const updateUserEmail = (email: any) => {
    setUser(prev => prev ? ({ ...prev, email }): null);
  };

  const login = async (userData: User) => {
    console.log("Login function called with:", userData);
    setUser(userData);
    console.log("User set in context:", userData);
  };

  const logout = () => {
    setUser(null);
    removeLocalStorage(STORAGE_KEYS.USER_DATA);
    console.log("User cleared from context and localStorage");
  };

  return (
    <UserContext.Provider value={{ user, setUser, updateUserProfile, updateProfileImage, updateUserName, updateUserEmail, login, logout }}>
      {children}
    </UserContext.Provider>
  )
}

export const useUser = (): UserContextType => {
  const context = useContext(UserContext)
  if (context === undefined) {
    throw new Error("useUser must be used within a UserProvider")
  }
  return context
}
