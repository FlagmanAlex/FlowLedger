/** Контрагент по долгам (человек или организация, которому дали в долг
 *  или у которого взяли) — по образцу Holder у кошельков: свой список на
 *  каждую базу (userId), заводится инлайн прямо в форме долга, дефолтов
 *  нет. */
export interface Counterparty {
  id: string;
  userId: string;
  name: string;
  color?: string;
  createdAt: string;
}
