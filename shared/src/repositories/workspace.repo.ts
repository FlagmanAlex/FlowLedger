import { arrayRemove, arrayUnion, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import type { WorkspaceConfig } from '@flowledger/interfaces';
import { workspaceConfigDoc } from './collections.js';

export async function getWorkspaceConfig(): Promise<WorkspaceConfig | null> {
  const snap = await getDoc(workspaceConfigDoc());
  return snap.exists() ? snap.data() : null;
}

/** Creates workspace/config the first time an owner connects to their
 *  freshly provisioned project (see control-plane/functions). */
export async function createWorkspaceConfig(ownerUid: string, name: string): Promise<void> {
  await setDoc(workspaceConfigDoc(), {
    name,
    ownerUid,
    memberUids: [ownerUid],
    pendingInviteEmails: [],
    defaultCurrency: 'USD',
    createdAt: new Date().toISOString(),
  });
}

/** Owner adds an email to the allow-list; Security Rules let that email
 *  accept by adding itself to memberUids once they open the invite link. */
export async function inviteMemberByEmail(email: string): Promise<void> {
  await updateDoc(workspaceConfigDoc(), { pendingInviteEmails: arrayUnion(email) });
}

/** Called by the invited user once they've signed in to the owner's
 *  project — Security Rules only allow this write when their token email
 *  matches an entry in pendingInviteEmails. */
export async function acceptWorkspaceInvite(uid: string): Promise<void> {
  await updateDoc(workspaceConfigDoc(), { memberUids: arrayUnion(uid) });
}

export async function removeMember(uid: string): Promise<void> {
  await updateDoc(workspaceConfigDoc(), { memberUids: arrayRemove(uid) });
}
