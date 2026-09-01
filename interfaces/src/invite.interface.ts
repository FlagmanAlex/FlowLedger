export type InviteStatus = 'pending' | 'accepted' | 'revoked';

/** Документ `invites/{inviteId}` — приглашение в общий доступ к базе
 *  `ownerId` по ссылке (`/invite/{inviteId}`). Неугадываемый `inviteId`
 *  (сгенерирован Firestore) — это и есть секрет ссылки, отдельного токена
 *  не заводим.
 *
 *  `createdAt`/`expiresAt`/`acceptedAt` — epoch-миллисекунды (а не ISO-строка,
 *  как в остальных типах), потому что `firestore.rules` сравнивает
 *  `expiresAt` с `request.time` при принятии приглашения — Firestore Security
 *  Rules умеют сравнивать только числа/Timestamp, не строки дат. */
export interface Invite {
  id: string;
  ownerId: string;
  ownerDisplayName: string;
  status: InviteStatus;
  createdAt: number;
  expiresAt: number;
  acceptedBy?: string;
  acceptedAt?: number;
}
