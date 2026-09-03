import { addDoc, getDocs, query, where } from 'firebase/firestore';
import type { Holder } from '@flowledger/interfaces';
import { holdersCollection } from './collections.js';

export async function listHolders(userId: string): Promise<Holder[]> {
  const snap = await getDocs(query(holdersCollection(), where('userId', '==', userId)));
  return snap.docs.map((d) => d.data());
}

export async function createHolder(
  userId: string,
  input: Omit<Holder, 'id' | 'userId' | 'createdAt'>,
): Promise<string> {
  const ref = await addDoc(holdersCollection(), {
    ...input,
    userId,
    createdAt: new Date().toISOString(),
  } as Holder);
  return ref.id;
}
