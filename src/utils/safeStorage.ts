/**
 * Safe storage utility with in-memory fallback for environments where
 * localStorage or sessionStorage is restricted, blocked, or throws SecurityError
 * (e.g. cross-origin iframe preview, sandboxed environments, private browsing).
 */

const memoryStorage = new Map<string, string>();
const memorySessionStorage = new Map<string, string>();

export const safeStorage = {
  getItem: (key: string): string | null => {
    try {
      if (typeof window !== 'undefined' && 'localStorage' in window && window.localStorage) {
        return window.localStorage.getItem(key);
      }
    } catch {
      // Storage access blocked or restricted in iframe
    }
    return memoryStorage.get(key) ?? null;
  },

  setItem: (key: string, value: string): void => {
    try {
      if (typeof window !== 'undefined' && 'localStorage' in window && window.localStorage) {
        window.localStorage.setItem(key, value);
        return;
      }
    } catch {
      // Storage access blocked or restricted in iframe
    }
    memoryStorage.set(key, value);
  },

  removeItem: (key: string): void => {
    try {
      if (typeof window !== 'undefined' && 'localStorage' in window && window.localStorage) {
        window.localStorage.removeItem(key);
      }
    } catch {
      // Storage access blocked or restricted in iframe
    }
    memoryStorage.delete(key);
  }
};

export const safeSessionStorage = {
  getItem: (key: string): string | null => {
    try {
      if (typeof window !== 'undefined' && 'sessionStorage' in window && window.sessionStorage) {
        return window.sessionStorage.getItem(key);
      }
    } catch {
      // Storage access blocked or restricted in iframe
    }
    return memorySessionStorage.get(key) ?? null;
  },

  setItem: (key: string, value: string): void => {
    try {
      if (typeof window !== 'undefined' && 'sessionStorage' in window && window.sessionStorage) {
        window.sessionStorage.setItem(key, value);
        return;
      }
    } catch {
      // Storage access blocked or restricted in iframe
    }
    memorySessionStorage.set(key, value);
  },

  removeItem: (key: string): void => {
    try {
      if (typeof window !== 'undefined' && 'sessionStorage' in window && window.sessionStorage) {
        window.sessionStorage.removeItem(key);
      }
    } catch {
      // Storage access blocked or restricted in iframe
    }
    memorySessionStorage.delete(key);
  }
};
