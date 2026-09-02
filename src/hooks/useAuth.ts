/* ─────────────────────────────────────────────────────────────
   Hook – useAuth
   Manages Firebase auth state with session persistence.
   Allows authorized admin accounts (from Firestore or VITE_ADMIN_EMAIL) to log in.
   ───────────────────────────────────────────────────────────── */
import { useState, useEffect, useCallback } from 'react';
import type { User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import {
  signInWithEmail,
  signOutUser,
  onAuthStateChange,
  registerFirstAdminAccount,
  checkIfAdminInitialized,
  getIsRegisteringAdmin,
  updateAdminPassword,
} from '@/services/firebase/auth';
import { db } from '@/services/firebase/config';
import { FIRESTORE_COLLECTIONS } from '@/constants';
import type { AuthUser, AdminStatus } from '@/types';

interface UseAuthReturn {
  user: AuthUser | null;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  setupFirstAdmin: (email: string, password: string, displayName: string) => Promise<void>;
  changePassword: (email: string, currentPass: string, newPass: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
  checkAdminStatus: () => Promise<AdminStatus>;
}

const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL as string | undefined;

function mapFirebaseUser(user: User): AuthUser {
  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
  };
}

/**
 * Check if a Firebase user is an authorized admin via Firestore or Env.
 */
async function isAdminUser(firebaseUser: User): Promise<boolean> {
  // 1. Check Firestore user document (primary source of truth)
  if (db) {
    try {
      const userDoc = await getDoc(doc(db, FIRESTORE_COLLECTIONS.USERS, firebaseUser.uid));
      if (userDoc.exists()) {
        const uData = userDoc.data();
        if (uData?.role === 'admin' || uData?.isSuperAdmin === true) {
          return true;
        }
      }

      const adminMarker = await getDoc(doc(db, FIRESTORE_COLLECTIONS.VIDEOS, '_settings_admin'));
      if (adminMarker.exists()) {
        const mData = adminMarker.data();
        if (mData?.adminEmail === firebaseUser.email?.toLowerCase()) {
          return true;
        }
      }
    } catch (e) {
      console.warn('Error checking admin permissions in Firestore:', e);
    }
  }

  // 2. Env variable whitelist fallback
  if (ADMIN_EMAIL && ADMIN_EMAIL.trim() !== '') {
    if (firebaseUser.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
      return true;
    }
  }

  // If no env whitelist is set and no userDoc exists yet (e.g. initial setup)
  if (!ADMIN_EMAIL || ADMIN_EMAIL.trim() === '') return true;

  return false;
}

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChange(async (firebaseUser) => {
      if (firebaseUser) {
        if (getIsRegisteringAdmin()) {
          // Registration is actively creating Firestore records; do not intercept/reject
          setUser(mapFirebaseUser(firebaseUser));
          setIsLoading(false);
          return;
        }

        const isAuthAdmin = await isAdminUser(firebaseUser);
        if (isAuthAdmin) {
          setUser(mapFirebaseUser(firebaseUser));
        } else {
          setUser(null);
          setError('Access denied. This panel is restricted to authorized admin accounts.');
          await signOutUser();
        }
      } else {
        setUser(null);
      }
      setIsLoading(false);
    });

    return unsubscribe;
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setError(null);
    setIsLoading(true);
    try {
      await signInWithEmail(email, password);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Login failed. Please try again.';
      setError(message);
      throw new Error(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const setupFirstAdmin = useCallback(
    async (email: string, password: string, displayName: string) => {
      setError(null);
      setIsLoading(true);
      try {
        const adminUser = await registerFirstAdminAccount(email, password, displayName);
        setUser(mapFirebaseUser(adminUser));
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Admin setup failed. Please try again.';
        setError(message);
        throw new Error(message);
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const changePassword = useCallback(
    async (email: string, currentPass: string, newPass: string) => {
      setError(null);
      setIsLoading(true);
      try {
        await updateAdminPassword(email, currentPass, newPass);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to update password.';
        setError(message);
        throw new Error(message);
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const logout = useCallback(async () => {
    setError(null);
    try {
      await signOutUser();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Logout failed. Please try again.');
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const checkAdminStatus = useCallback(async () => {
    return await checkIfAdminInitialized();
  }, []);

  return { user, isLoading, error, login, setupFirstAdmin, changePassword, logout, clearError, checkAdminStatus };
}
