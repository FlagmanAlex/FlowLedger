import type { FirebaseWebAppConfig } from './customer.interface.js';

export type WorkspaceRole = 'owner' | 'member';

/** The single document (`workspace/config`) inside a customer's own
 *  Firebase project — one workspace per project, no tenantId needed. */
export interface WorkspaceConfig {
  name: string;
  ownerUid: string;
  memberUids: string[];
  pendingInviteEmails: string[];
  defaultCurrency: string;
  createdAt: string;
}

/** A Firebase project the current device is connected to — the user's own
 *  (owner) and/or ones they joined via an invite link (member). Stored
 *  locally on-device, not in any shared backend. */
export interface ConnectedWorkspace {
  label: string;
  projectId: string;
  firebaseConfig: FirebaseWebAppConfig;
  role: WorkspaceRole;
}
