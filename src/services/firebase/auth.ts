/* ─────────────────────────────────────────────────────────────
   Firebase – Authentication Service
   ───────────────────────────────────────────────────────────── */
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  updatePassword,
  signOut,
  onAuthStateChanged,
  type User,
  type Unsubscribe,
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './config';
import { FIRESTORE_COLLECTIONS } from '@/constants';
import type { AdminStatus } from '@/types';

/**
 * Check if the admin accounts have been initialized and whether registration is allowed in Firestore.
 * Allows up to 3 admins. If count < 3, allowRegistration is true. If count >= 3, allowRegistration is false.
 */
export async function checkIfAdminInitialized(): Promise<AdminStatus> {
  const isLocallyLocked = localStorage.getItem('syd_admin_initialized') === 'true';

  if (!db) {
    return {
      initialized: isLocallyLocked,
      allowRegistration: !isLocallyLocked,
      adminCount: isLocallyLocked ? 3 : 0,
    };
  }

  try {
    const docRef = doc(db, FIRESTORE_COLLECTIONS.VIDEOS, '_settings_admin');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      const adminCount: number = typeof data?.adminCount === 'number'
        ? data.adminCount
        : (Array.isArray(data?.admins) ? data.admins.length : (data?.initialized ? 1 : 0));
      const isInit = adminCount > 0 || Boolean(data?.initialized);
      
      // Allow registration only if less than 3 admins have been created
      const allowReg = adminCount < 3 && data?.allowRegistration !== false;

      if (adminCount >= 3) {
        localStorage.setItem('syd_admin_initialized', 'true');
      } else {
        localStorage.removeItem('syd_admin_initialized');
      }

      return {
        initialized: isInit,
        allowRegistration: allowReg,
        adminCount,
        adminEmail: data?.adminEmail,
      };
    }

    const oldDocRef = doc(db, FIRESTORE_COLLECTIONS.SETTINGS, 'admin_config');
    const oldSnap = await getDoc(oldDocRef);
    if (oldSnap.exists()) {
      const data = oldSnap.data();
      const adminCount: number = typeof data?.adminCount === 'number'
        ? data.adminCount
        : (Array.isArray(data?.admins) ? data.admins.length : (data?.initialized ? 1 : 0));
      const isInit = adminCount > 0 || Boolean(data?.initialized);
      const allowReg = adminCount < 3 && data?.allowRegistration !== false;

      if (adminCount >= 3) {
        localStorage.setItem('syd_admin_initialized', 'true');
      } else {
        localStorage.removeItem('syd_admin_initialized');
      }

      return {
        initialized: isInit,
        allowRegistration: allowReg,
        adminCount,
        adminEmail: data?.adminEmail,
      };
    }

    return {
      initialized: false,
      allowRegistration: true,
      adminCount: 0,
    };
  } catch {
    return {
      initialized: isLocallyLocked,
      allowRegistration: !isLocallyLocked,
      adminCount: isLocallyLocked ? 3 : 0,
    };
  }
}

let isRegisteringAdminFlag = false;

export function getIsRegisteringAdmin(): boolean {
  return isRegisteringAdminFlag;
}

export function setIsRegisteringAdmin(val: boolean): void {
  isRegisteringAdminFlag = val;
}

/**
 * Register an Admin Account (up to a maximum of 3 admins).
 * Creates the user in Firebase Auth, stores credentials in Firestore, and updates admin count.
 */
export async function registerFirstAdminAccount(
  email: string,
  password: string,
  displayName: string,
): Promise<User> {
  if (!auth || !db) throw new Error('Firebase is not configured.');
  setIsRegisteringAdmin(true);
  try {
    // Check if 3 or more admins already exist
    const status = await checkIfAdminInitialized();
    const currentCount = status.adminCount ?? (status.initialized ? 1 : 0);

    if (currentCount >= 3 || !status.allowRegistration) {
      throw new Error(
        'Maximum limit of 3 admin accounts reached. Admin registration is closed.',
      );
    }

    const credential = await createUserWithEmailAndPassword(auth, email, password);
    const user = credential.user;

    // Update Auth profile name
    await updateProfile(user, { displayName });

    // 1. Save user document in Firestore with role: 'admin' and password
    await setDoc(
      doc(db, FIRESTORE_COLLECTIONS.USERS, user.uid),
      {
        uid: user.uid,
        email: user.email,
        displayName,
        password: password, // Stored in Firestore as requested
        role: 'admin',
        isSuperAdmin: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );

    // 2. Compute new admin count & determine if further registrations are allowed
    const newCount = currentCount + 1;
    const canRegisterMore = newCount < 3;

    const adminMarker = {
      initialized: true,
      adminCount: newCount,
      allowRegistration: canRegisterMore,
      adminEmail: email.toLowerCase(),
      lastAdminUid: user.uid,
      password: password,
      updatedAt: serverTimestamp(),
    };

    if (!canRegisterMore) {
      localStorage.setItem('syd_admin_initialized', 'true');
    } else {
      localStorage.removeItem('syd_admin_initialized');
    }

    await Promise.all([
      setDoc(doc(db, FIRESTORE_COLLECTIONS.VIDEOS, '_settings_admin'), adminMarker, { merge: true }),
      setDoc(doc(db, FIRESTORE_COLLECTIONS.SETTINGS, 'admin_config'), adminMarker, { merge: true }),
    ]);

    return user;
  } catch (error: unknown) {
    throw new Error(getAuthErrorMessage(error));
  } finally {
    setIsRegisteringAdmin(false);
  }
}

/**
 * Sign in with email and password.
 * Throws a typed error message for common Firebase auth errors.
 */
export async function signInWithEmail(email: string, password: string): Promise<User> {
  if (!auth) throw new Error('Firebase is not configured. Please set up your .env file.');
  try {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    return credential.user;
  } catch (error: unknown) {
    throw new Error(getAuthErrorMessage(error));
  }
}

/**
 * Sign out the current user.
 */
export async function signOutUser(): Promise<void> {
  if (!auth) return;
  try {
    await signOut(auth);
  } catch {
    throw new Error('Failed to sign out. Please try again.');
  }
}

/**
 * Subscribe to auth state changes.
 * Returns an unsubscribe function. No-ops if Firebase is not configured.
 */
export function onAuthStateChange(callback: (user: User | null) => void): Unsubscribe {
  if (!auth) {
    callback(null);
    return () => undefined;
  }
  return onAuthStateChanged(auth, callback);
}

/**
 * Update Admin Password:
 * Verifies current password by signing in, then updates password in Firebase Auth and Firestore.
 */
export async function updateAdminPassword(
  email: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  if (!auth || !db) throw new Error('Firebase is not configured.');
  if (!email.trim()) throw new Error('Please enter your admin email.');
  if (newPassword.length < 6) {
    throw new Error('New password must be at least 6 characters.');
  }
  if (currentPassword === newPassword) {
    throw new Error('New password must be different from current password.');
  }

  try {
    // 1. Verify current password
    const credential = await signInWithEmailAndPassword(auth, email.trim(), currentPassword);
    const user = credential.user;

    // 2. Update password in Firebase Auth
    await updatePassword(user, newPassword);

    // 3. Update password in Firestore users collection
    await setDoc(
      doc(db, FIRESTORE_COLLECTIONS.USERS, user.uid),
      {
        password: newPassword,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );

    // 4. Update in settings markers
    const updateMarker = {
      password: newPassword,
      adminEmail: email.toLowerCase().trim(),
      updatedAt: serverTimestamp(),
    };

    await Promise.allSettled([
      setDoc(doc(db, FIRESTORE_COLLECTIONS.VIDEOS, '_settings_admin'), updateMarker, { merge: true }),
      setDoc(doc(db, FIRESTORE_COLLECTIONS.SETTINGS, 'admin_config'), updateMarker, { merge: true }),
    ]);
  } catch (error: unknown) {
    throw new Error(getAuthErrorMessage(error));
  }
}

/** Maps Firebase auth error codes to user-friendly messages */
function getAuthErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code: string }).code;
    switch (code) {
      case 'auth/user-not-found':
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        return 'Invalid email or password. Please verify your current credentials.';
      case 'auth/email-already-in-use':
        return 'An account with this email already exists.';
      case 'auth/weak-password':
        return 'Password should be at least 6 characters.';
      case 'auth/invalid-email':
        return 'Please enter a valid email address.';
      case 'auth/too-many-requests':
        return 'Too many failed attempts. Please wait a moment and try again.';
      case 'auth/network-request-failed':
        return 'Network error. Please check your connection.';
      case 'auth/user-disabled':
        return 'This account has been disabled. Please contact support.';
      case 'auth/requires-recent-login':
        return 'Please re-enter your current password to confirm this change.';
      default:
        return 'Authentication request failed. Please check credentials.';
    }
  }
  return 'An unexpected error occurred. Please try again.';
}
