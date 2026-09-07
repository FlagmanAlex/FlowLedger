import { addDoc, getDocs, query, where } from 'firebase/firestore';
import type { Counterparty } from '@flowledger/interfaces';
import { counterpartiesCollection } from './collections.js';

export async function listCounterparties(userId: string): Promise<Counterparty[]> {
  const snap = await getDocs(query(counterpartiesCollection(), where('userId', '==', userId)));
  return snap.docs.map((d) => d.data());
}

export async function createCounterparty(
  userId: string,
  input: Omit<Counterparty, 'id' | 'userId' | 'createdAt'>,
): Promise<string> {
  const ref = await addDoc(counterpartiesCollection(), {
    ...input,
    userId,
    createdAt: new Date().toISOString(),
  } as Counterparty);
  return ref.id;
}
