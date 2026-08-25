import { addDoc, deleteDoc, doc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import type { Wallet } from '@flowledger/interfaces';
import { walletsCollection } from './collections.js';

export async function listWallets(tenantId: string): Promise<Wallet[]> {
  const snap = await getDocs(query(walletsCollection(), where('tenantId', '==', tenantId)));
  return snap.docs.map((d) => d.data());
}

export async function createWallet(
  input: Omit<Wallet, 'id' | 'balance' | 'archived' | 'createdAt'>,
): Promise<string> {
  const ref = await addDoc(walletsCollection(), {
    ...input,
    balance: 0,
    archived: false,
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
