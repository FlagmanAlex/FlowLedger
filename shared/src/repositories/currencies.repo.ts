import { addDoc, getDocs, query, where } from 'firebase/firestore';
import type { Currency } from '@flowledger/interfaces';
import { currenciesCollection } from './collections.js';

const DEFAULT_CURRENCIES: Array<Pick<Currency, 'code' | 'name'>> = [
  { code: 'RUB', name: 'Рубли' },
  { code: 'USD', name: 'Доллары' },
  { code: 'UAH', name: 'Гривны' },
];

/** У новой базы (userId) валют ещё нет — заводим стандартный набор при
 *  первом обращении вместо отдельного шага онбординга. */
async function seedDefaultCurrencies(userId: string): Promise<Currency[]> {
  const createdAt = new Date().toISOString();
  return Promise.all(
    DEFAULT_CURRENCIES.map(async (c) => {
      const ref = await addDoc(currenciesCollection(), { ...c, userId, createdAt } as Currency);
      return { id: ref.id, userId, createdAt, ...c };
    }),
  );
}

export async function listCurrencies(userId: string): Promise<Currency[]> {
  const snap = await getDocs(query(currenciesCollection(), where('userId', '==', userId)));
  const currencies = snap.docs.map((d) => d.data());
  if (currencies.length > 0) return currencies;
  return seedDefaultCurrencies(userId);
}

export async function createCurrency(
  userId: string,
  input: Omit<Currency, 'id' | 'userId' | 'createdAt'>,
): Promise<string> {
  const ref = await addDoc(currenciesCollection(), {
    ...input,
    userId,
    createdAt: new Date().toISOString(),
  } as Currency);
  return ref.id;
}
