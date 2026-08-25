import {
  GoogleAuthProvider,
  onIdTokenChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User as FirebaseUser,
} from 'firebase/auth';
import type { AuthUser, TenantRole } from '@flowledger/interfaces';
import { getFirebaseAuth } from './app.js';

/**
 * Web sign-in flow. Native (Expo) apps use a different provider flow
 * (expo-auth-session / Google native SDK) but land on the same Firebase
 * Auth user + custom claims, so downstream code (hooks, repositories) is
 * identical across platforms.
 */
export async function signInWithGoogleWeb(): Promise<FirebaseUser> {
  const auth = getFirebaseAuth();
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(auth, provider);
  return result.user;
}

export async function signOut(): Promise<void> {
  await firebaseSignOut(getFirebaseAuth());
}

const TENANT_CLAIM_RETRY_DELAYS_MS = [500, 1000, 2000, 3000, 5000];

async function toAuthUser(user: FirebaseUser, forceRefresh = false): Promise<AuthUser | null> {
  const tokenResult = await user.getIdTokenResult(forceRefresh);
  const tenantId = tokenResult.claims.tenantId as string | undefined;
  const role = tokenResult.claims.role as TenantRole | undefined;

  if (!tenantId || !role) {
    return null;
  }

  return {
    uid: user.uid,
    email: user.email ?? '',
    displayName: user.displayName ?? '',
    photoURL: user.photoURL ?? undefined,
    tenantId,
    role,
  };
}

/**
 * The onUserCreate Cloud Function sets tenantId/role custom claims shortly
 * after first sign-in, but they aren't on the token yet at that instant.
 * Retry with a forced token refresh a few times before giving up, so a
 * brand-new user isn't bounced back to /login while their tenant is still
 * being provisioned.
 */
async function resolveAuthUserWithRetry(user: FirebaseUser): Promise<AuthUser | null> {
  let resolved = await toAuthUser(user);
  for (const delay of TENANT_CLAIM_RETRY_DELAYS_MS) {
    if (resolved) return resolved;
    await new Promise((r) => setTimeout(r, delay));
    resolved = await toAuthUser(user, true);
  }
  return resolved;
}

export function subscribeToAuthUser(callback: (user: AuthUser | null) => void): () => void {
  const auth = getFirebaseAuth();
  let cancelled = false;

  const unsubscribe = onIdTokenChanged(auth, async (firebaseUser) => {
    if (!firebaseUser) {
      callback(null);
      return;
    }
    const resolved = await resolveAuthUserWithRetry(firebaseUser);
    if (!cancelled) callback(resolved);
  });

  return () => {
    cancelled = true;
    unsubscribe();
  };
}
