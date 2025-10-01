/**
 * Utility functions for sessionStorage and localStorage operations with type safety and error handling
 */

// Storage keys
export const STORAGE_KEYS = {
  AUTH_SESSION: 'auth_session',
  EVENTS_CACHE: 'events_cache',
  DASHBOARD_PREFS: 'dashboard_prefs',
  USER_DATA: 'user',

  AUTH_REDIRECT: 'auth_redirect',
} as const;

// Types for stored data
export interface AuthSessionData {
  jwt: string;
  user: {
    email?: string;
    given_name?: string;
    family_name?: string;
    picture?: string;
    name?: string;
  };
  timestamp: number;
}

export interface EventsCacheData {
  events: any[];
  timestamp: number;
}

export interface DashboardPreferences {
  showUpcoming: boolean;
  regShowUpcoming: boolean;
}

export interface UserData {
  id?: string;
  name: string;
  email: string;
  bio?: string;
  instagram?: string;
  twitter?: string;
  youtube?: string;
  tiktok?: string;
  linkedin?: string;
  website?: string;
  mobile?: string;
  username?: string;
  walletAddress?: string;
  emails: { address: string; primary: boolean; verified: boolean }[];
  eventsAttended?: number;
  poapsCollected?: number;
  avatarUrl?: string;
  picture?: string;
  googleId?: string;
  googleToken?: string;
  isEnoki?: boolean;
  jwt?: string;
}

export interface EnokiSessionData {
  jwt: string;
  address: string;
  expiresAt: number;
}

// Storage type enum
export enum StorageType {
  SESSION = 'session',
  LOCAL = 'local'
}

/**
 * Generic storage getter with error handling
 */
const inMemoryStorage: Record<string, string> = {};

export const getStorage = <T>(key: string, type: StorageType = StorageType.SESSION): T | null => {
  try {
    if (typeof window === 'undefined') {
      // Fallback to in-memory storage on server or non-window environments
      const item = inMemoryStorage[key];
      if (!item) return null;
      return JSON.parse(item) as T;
    }

    const storage = type === StorageType.SESSION ? window.sessionStorage : window.localStorage;
    const item = storage.getItem(key);
    if (!item) return null;

    return JSON.parse(item) as T;
  } catch (error) {
    // Suppress error logs to avoid noisy warnings during SSR
    // console.error(`Error reading from ${type}Storage (key: ${key}):`, error);
    return null;
  }
};

/**
 * Generic storage setter with error handling
 */
export const setStorage = <T>(key: string, value: T, type: StorageType = StorageType.SESSION): boolean => {
  try {
    if (typeof window === 'undefined') {
      // Fallback to in-memory storage on server or non-window environments
      inMemoryStorage[key] = JSON.stringify(value);
      return true;
    }

    const storage = type === StorageType.SESSION ? window.sessionStorage : window.localStorage;
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    // Suppress error logs to avoid noisy warnings during SSR
    // console.error(`Error writing to ${type}Storage (key: ${key}):`, error);
    return false;
  }
};

/**
 * Generic storage remover with error handling
 */
export const removeStorage = (key: string, type: StorageType = StorageType.SESSION): boolean => {
  try {
    if (typeof window === 'undefined') {
      // Fallback to in-memory storage on server or non-window environments
      delete inMemoryStorage[key];
      return true;
    }

    const storage = type === StorageType.SESSION ? window.sessionStorage : window.localStorage;
    storage.removeItem(key);
    return true;
  } catch (error) {
    // Suppress error logs to avoid noisy warnings during SSR
    // console.error(`Error removing from ${type}Storage (key: ${key}):`, error);
    return false;
  }
};

/**
 * Generic storage clearer with error handling
 */
export const clearStorage = (type: StorageType = StorageType.SESSION): boolean => {
  try {
    if (typeof window === 'undefined') {
      // Fallback to in-memory storage on server or non-window environments
      for (const key in inMemoryStorage) {
        delete inMemoryStorage[key];
      }
      return true;
    }

    const storage = type === StorageType.SESSION ? window.sessionStorage : window.localStorage;
    storage.clear();
    return true;
  } catch (error) {
    // Suppress error logs to avoid noisy warnings during SSR
    // console.error(`Error clearing ${type}Storage:`, error);
    return false;
  }
};

/**
 * Check if cached data is still valid based on TTL (time-to-live in milliseconds)
 */
export const isCacheValid = (timestamp: number, ttl: number = 5 * 60 * 1000): boolean => {
  return Date.now() - timestamp < ttl;
};

/**
 * Check if session data is still valid based on expiration time
 */
export const isSessionValid = (expiresAt: number): boolean => {
  return Date.now() < expiresAt;
};

export const getSessionStorage = <T>(key: string): T | null => getStorage<T>(key, StorageType.SESSION);
export const setSessionStorage = <T>(key: string, value: T): boolean => setStorage<T>(key, value, StorageType.SESSION);
export const removeSessionStorage = (key: string): boolean => removeStorage(key, StorageType.SESSION);
export const clearSessionStorage = (): boolean => clearStorage(StorageType.SESSION);

export const getLocalStorage = <T>(key: string): T | null => getStorage<T>(key, StorageType.LOCAL);
export const setLocalStorage = <T>(key: string, value: T): boolean => setStorage<T>(key, value, StorageType.LOCAL);
export const removeLocalStorage = (key: string): boolean => removeStorage(key, StorageType.LOCAL);
export const clearLocalStorage = (): boolean => clearStorage(StorageType.LOCAL);
