/** Документ `users/{ownerId}/members/{uid}` — участник, получивший доступ
 *  к базе `ownerId` по приглашению. `inviteId` — какое приглашение открыло
 *  доступ (для аудита и проверки в `firestore.rules` при создании). */
export interface Member {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  inviteId: string;
  joinedAt: string;
}
