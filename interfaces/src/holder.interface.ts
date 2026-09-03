/** Владелец кошелька — для группировки кошельков при общем доступе к базе
 *  (например, у супругов): «Я», «Жена», «Общие» и т.п. Список — свой у
 *  каждой базы (userId), задаётся пользователем, дефолтов нет. */
export interface Holder {
  id: string;
  userId: string;
  name: string;
  color?: string;
  createdAt: string;
}
