export interface Wallet {
  id: string;
  userId: string;
  name: string;
  currency: string;
  balance: number;
  /** Владелец кошелька (см. Holder) — группировка кошельков при общем
   *  доступе к базе (например, у супругов): «мои» / «жены» / общие. */
  holderId?: string;
  icon?: string;
  color?: string;
  archived: boolean;
  createdAt: string;
}
