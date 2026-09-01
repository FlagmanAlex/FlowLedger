import { addDoc, doc, getDoc, getDocs, query, updateDoc, where, writeBatch } from 'firebase/firestore';
import type { AuthUser, Invite } from '@flowledger/interfaces';
import { getFirestoreInstance } from '../firebase/firebase.js';
import { invitesCollection, membersCollection } from './collections.js';
import { userDoc } from './users.repo.js';

const INVITE_TTL_DAYS = 7;

/** Создаёт приглашение в общий доступ к базе `ownerId`; неугадываемый id
 *  документа — это и есть секрет ссылки `/invite/{id}`. */
export async function createInvite(ownerId: string, ownerDisplayName: string): Promise<string> {
  const now = Date.now();

  const ref = await addDoc(invitesCollection(), {
    ownerId,
    ownerDisplayName,
    status: 'pending',
    createdAt: now,
    expiresAt: now + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000,
  } as Invite);
  return ref.id;
}

export async function getInvite(inviteId: string): Promise<Invite | null> {
  const snap = await getDoc(doc(invitesCollection(), inviteId));
  return snap.exists() ? snap.data() : null;
}

export async function listPendingInvites(ownerId: string): Promise<Invite[]> {
  const snap = await getDocs(
    query(invitesCollection(), where('ownerId', '==', ownerId), where('status', '==', 'pending')),
  );
  return snap.docs.map((d) => d.data());
}

export async function revokeInvite(inviteId: string): Promise<void> {
  await updateDoc(doc(invitesCollection(), inviteId), { status: 'revoked' });
}

/**
 * Принятие приглашения — три записи одним batch (без Cloud Function, план
 * остаётся Spark, см. `memory.md`): добавляет принявшего в
 * `users/{ownerId}/members`, помечает приглашение принятым и переключает
 * `activeOwnerId` принявшего на `ownerId`. Легитимность проверяет
 * `firestore.rules` (создание члена разрешено только со ссылкой на valid
 * pending-приглашение).
 */
export async function acceptInvite(invite: Invite, acceptor: AuthUser): Promise<void> {
  const now = Date.now();
  const batch = writeBatch(getFirestoreInstance());

  batch.set(doc(membersCollection(invite.ownerId), acceptor.uid), {
    uid: acceptor.uid,
    email: acceptor.email,
    displayName: acceptor.displayName,
    photoURL: acceptor.photoURL,
    inviteId: invite.id,
    joinedAt: new Date(now).toISOString(),
  });
  batch.update(doc(invitesCollection(), invite.id), {
    status: 'accepted',
    acceptedBy: acceptor.uid,
    acceptedAt: now,
  });
  batch.update(userDoc(acceptor.uid), { activeOwnerId: invite.ownerId });

  await batch.commit();
}
