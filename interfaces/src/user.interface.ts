import type { TenantRole } from './tenant.interface.js';

export interface User {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  tenantId: string;
  role: TenantRole;
  createdAt: string;
}

export interface AuthUser {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  tenantId: string;
  role: TenantRole;
}
