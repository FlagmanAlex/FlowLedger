import {
  GoogleAuthProvider,
  onIdTokenChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User as FirebaseUser,
} from 'firebase/auth';
import type { AuthUser } from '@flowledger/interfaces';
import { getControlPlaneAuth } from './controlPlane.js';
import { getCustomerAuth, isCustomerFirebaseConnected } from './customer.js';

function toAuthUser(user: FirebaseUser): AuthUser {
  return {
    uid: user.uid,
    email: user.email ?? '',
    displayName: user.displayName ?? '',
    photoURL: user.photoURL ?? undefined,
    // Resolved separately from workspace/config.memberUids — see
    // shared/src/hooks/useWorkspace.ts — since it's project-local state,
    // not something Firebase Auth knows about.
    role: 'member',
  };
}

/** Basic Google sign-in against the control-plane project, just to
 *  identify the customer (no elevated scopes). */
export async function signInControlPlaneWithGoogle(): Promise<FirebaseUser> {
  const result = await signInWithPopup(getControlPlaneAuth(), new GoogleAuthProvider());
  return result.user;
}

/**
 * Re-prompts the same user for the extra OAuth scopes needed to call the
 * Firebase/Google Cloud Management APIs on their behalf (project creation,
 * enabling services, deploying rules) — see
 * control-plane/functions/src/provisioning/. Returns the OAuth access
 * token to pass into the createCustomerProject callable; nothing is
 * persisted, it's used once for that call.
 */
export async function requestCloudPlatformAccessToken(): Promise<string> {
  const provider = new GoogleAuthProvider();
  provider.addScope('https://www.googleapis.com/auth/cloud-platform');
  provider.addScope('https://www.googleapis.com/auth/firebase');

  const result = await signInWithPopup(getControlPlaneAuth(), provider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  if (!credential?.accessToken) {
    throw new Error('Google did not return an access token for the requested scopes.');
  }
  return credential.accessToken;
}

/** Sign-in against a connected customer project (owner's own, or one
 *  joined via an invite link) — see shared/src/firebase/customer.ts. */
export async function signInCustomerWithGoogle(): Promise<FirebaseUser> {
  const result = await signInWithPopup(getCustomerAuth(), new GoogleAuthProvider());
  return result.user;
}

export async function signOutControlPlane(): Promise<void> {
  await firebaseSignOut(getControlPlaneAuth());
}

export async function signOutCustomer(): Promise<void> {
  await firebaseSignOut(getCustomerAuth());
}

export function subscribeToControlPlaneAuthUser(
  callback: (user: FirebaseUser | null) => void,
): () => void {
  return onIdTokenChanged(getControlPlaneAuth(), callback);
}

/**
 * No-ops as "signed out" instead of throwing when no customer project is
 * connected yet (e.g. a fresh visit that hasn't been through
 * ConnectingScreen/JoinScreen) — callers like useAuth/AuthLayout rely on
 * this to redirect to /login rather than crash the app shell.
 */
export function subscribeToCustomerAuthUser(
  callback: (user: AuthUser | null) => void,
): () => void {
  if (!isCustomerFirebaseConnected()) {
    callback(null);
    return () => {};
  }

  return onIdTokenChanged(getCustomerAuth(), (firebaseUser) => {
    callback(firebaseUser ? toAuthUser(firebaseUser) : null);
  });
}
