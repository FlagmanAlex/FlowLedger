import { deleteDoc, doc, getDocs } from 'firebase/firestore';
import type { Member } from '@flowledger/interfaces';
import { membersCollection } from './collections.js';
import { setActiveOwner } from './users.repo.js';

export async function listMembers(ownerId: string): Promise<Member[]> {
  const snap = await getDocs(membersCollection(ownerId));
  return snap.docs.map((d) => d.data());
}

/** Владелец отзывает доступ участника к своей базе. */
export async function removeMember(ownerId: string, memberUid: string): Promise<void> {
  await deleteDoc(doc(membersCollection(ownerId), memberUid));
}

/** Участник сам покидает общий доступ и возвращается к своей базе. */
export async function leaveSharedAccess(ownerId: string, memberUid: string): Promise<void> {
  await deleteDoc(doc(membersCollection(ownerId), memberUid));
  await setActiveOwner(memberUid, undefined);
}
