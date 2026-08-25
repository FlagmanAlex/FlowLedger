import { auth as authTrigger } from 'firebase-functions/v1';
import { db, auth } from '../admin.js';

/**
 * Every new Firebase user gets their own tenant on first sign-in — each user
 * starts with an isolated "project" and can invite others into it later.
 */
export const onUserCreate = authTrigger.user().onCreate(async (user) => {
  const tenantRef = db.collection('tenants').doc();
  const now = new Date().toISOString();

  await tenantRef.set({
    name: `${user.displayName ?? user.email ?? 'My'} workspace`,
    ownerUid: user.uid,
    memberUids: [user.uid],
    defaultCurrency: 'USD',
    createdAt: now,
  });

  await auth.setCustomUserClaims(user.uid, {
    tenantId: tenantRef.id,
    role: 'owner',
  });

  await db.collection('users').doc(user.uid).set({
    uid: user.uid,
    email: user.email ?? '',
    displayName: user.displayName ?? '',
    photoURL: user.photoURL ?? null,
    tenantId: tenantRef.id,
    role: 'owner',
    createdAt: now,
  });
});
