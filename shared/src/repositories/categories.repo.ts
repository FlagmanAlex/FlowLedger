import { addDoc, deleteDoc, doc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import type { Category } from '@flowledger/interfaces';
import { categoriesCollection } from './collections.js';

export async function listCategories(tenantId: string): Promise<Category[]> {
  const snap = await getDocs(query(categoriesCollection(), where('tenantId', '==', tenantId)));
  return snap.docs.map((d) => d.data());
}

export async function createCategory(
  input: Omit<Category, 'id' | 'createdAt'>,
): Promise<string> {
  const ref = await addDoc(categoriesCollection(), {
    ...input,
    createdAt: new Date().toISOString(),
  } as Category);
  return ref.id;
}

export async function updateCategory(id: string, patch: Partial<Category>): Promise<void> {
  await updateDoc(doc(categoriesCollection(), id), patch);
}

export async function deleteCategory(id: string): Promise<void> {
  await deleteDoc(doc(categoriesCollection(), id));
}
