export interface Tenant {
  id: string;
  name: string;
  ownerUid: string;
  memberUids: string[];
  defaultCurrency: string;
  createdAt: string;
}

export type TenantRole = 'owner' | 'member';

export interface Invite {
  id: string;
  tenantId: string;
  email: string;
  invitedBy: string;
  status: 'pending' | 'accepted' | 'revoked';
  createdAt: string;
}
