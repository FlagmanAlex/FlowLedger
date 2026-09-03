import { addDoc, deleteDoc, doc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import type { Wallet } from '@flowledger/interfaces';
import { walletsCollection } from './collections.js';

/** Кошельки без явного sortOrder (заведённые до появления ручной сортировки)
 *  сортируются по времени создания — тот же порядок, что был раньше. */
function effectiveOrder(w: Wallet): number {
  return w.sortOrder ?? new Date(w.createdAt).getTime();
}

export async function listWallets(userId: string): Promise<Wallet[]> {
  const snap = await getDocs(query(walletsCollection(), where('userId', '==', userId)));
  return snap.docs.map((d) => d.data()).sort((a, b) => effectiveOrder(a) - effectiveOrder(b));
}

export async function createWallet(
  userId: string,
  input: Omit<Wallet, 'id' | 'userId' | 'balance' | 'archived' | 'createdAt' | 'sortOrder'>,
): Promise<string> {
  const ref = await addDoc(walletsCollection(), {
    ...input,
    userId,
    balance: 0,
    archived: false,
    sortOrder: Date.now(),
    createdAt: new Date().toISOString(),
  } as Wallet);
  return ref.id;
}

export async function updateWallet(id: string, patch: Partial<Wallet>): Promise<void> {
  await updateDoc(doc(walletsCollection(), id), patch);
}

export async function archiveWallet(id: string): Promise<void> {
  await updateDoc(doc(walletsCollection(), id), { archived: true });
}

export async function deleteWallet(id: string): Promise<void> {
  await deleteDoc(doc(walletsCollection(), id));
}
