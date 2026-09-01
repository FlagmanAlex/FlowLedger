export type UserPlan = 'free' | 'premium';

/** Документ `users/{uid}` — единый Firebase-проект продукта, изоляция данных
 *  между пользователями через это поле, а не через отдельные проекты.
 *
 *  `activeOwnerId` — чью базу (`userId` в wallets/categories/transactions)
 *  сейчас использует этот пользователь: свою (uid, поле не задано) или базу
 *  другого пользователя, к которой получил доступ по приглашению (см.
 *  `Invite`/`Member`). Меняется только на собственном документе — доверенный
 *  server-side механизм не нужен, это self-service (см. `firestore.rules`). */
export interface User {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  plan: UserPlan;
  createdAt: string;
  activeOwnerId?: string;
}

/** Текущий вошедший пользователь (то же самое, что User, без createdAt —
 *  берётся из Firebase Auth, а не из документа users/{uid}). */
export interface AuthUser {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
}
