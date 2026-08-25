import type { WorkspaceRole } from './workspace.interface.js';

export interface User {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: WorkspaceRole;
  createdAt: string;
}

/** The signed-in user within the currently active connected workspace
 *  (Firebase project) — uid/role are scoped to that project, not global. */
export interface AuthUser {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: WorkspaceRole;
}
