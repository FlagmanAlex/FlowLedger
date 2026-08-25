export interface Wallet {
  id: string;
  tenantId: string;
  name: string;
  currency: string;
  balance: number;
  icon?: string;
  color?: string;
  archived: boolean;
  createdAt: string;
}
