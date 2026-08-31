export type UserPlan = 'free' | 'premium';

/** Документ `users/{uid}` — единый Firebase-проект продукта, изоляция данных
 *  между пользователями через это поле, а не через отдельные проекты. */
export interface User {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  plan: UserPlan;
  createdAt: string;
}

/** Текущий вошедший пользователь (то же самое, что User, без createdAt —
 *  берётся из Firebase Auth, а не из документа users/{uid}). */
export interface AuthUser {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
}
