import { FieldValue } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { db, auth } from '../admin.js';

interface AcceptInvitePayload {
  inviteId: string;
}

/**
 * Adds the calling user to the tenant referenced by a pending invite, so a
 * household/team can share one set of wallets, categories and transactions.
 */
export const acceptInvite = onCall<AcceptInvitePayload>(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Sign in required.');
  }

  const { inviteId } = request.data;
  const inviteRef = db.collection('invites').doc(inviteId);
  const inviteSnap = await inviteRef.get();

  if (!inviteSnap.exists) {
    throw new HttpsError('not-found', 'Invite not found.');
  }

  const invite = inviteSnap.data()!;
  if (invite.status !== 'pending') {
    throw new HttpsError('failed-precondition', 'Invite is no longer pending.');
  }
  if (invite.email !== request.auth.token.email) {
    throw new HttpsError('permission-denied', 'Invite email does not match signed-in user.');
  }

  const uid = request.auth.uid;
  const tenantRef = db.collection('tenants').doc(invite.tenantId);

  await tenantRef.update({ memberUids: FieldValue.arrayUnion(uid) });
  await auth.setCustomUserClaims(uid, { tenantId: invite.tenantId, role: 'member' });
  await inviteRef.update({ status: 'accepted' });

  return { tenantId: invite.tenantId };
});

interface CreateInvitePayload {
  email: string;
}

/**
 * Lets an existing tenant member invite someone else by email.
 */
export const createInvite = onCall<CreateInvitePayload>(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Sign in required.');
  }

  const tenantId = request.auth.token.tenantId as string | undefined;
  if (!tenantId) {
    throw new HttpsError('failed-precondition', 'Signed-in user has no tenant.');
  }

  const { email } = request.data;
  const inviteRef = db.collection('invites').doc();

  await inviteRef.set({
    tenantId,
    email,
    invitedBy: request.auth.uid,
    status: 'pending',
    createdAt: new Date().toISOString(),
  });

  return { inviteId: inviteRef.id };
});
