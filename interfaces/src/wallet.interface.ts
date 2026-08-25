export interface Wallet {
  id: string;
  name: string;
  currency: string;
  balance: number;
  icon?: string;
  color?: string;
  archived: boolean;
  createdAt: string;
}
