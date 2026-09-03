import { addDoc, deleteDoc, doc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import type { Category } from '@flowledger/interfaces';
import { categoriesCollection } from './collections.js';

/** Категории без явного sortOrder (заведённые до появления ручной сортировки)
 *  сортируются по времени создания — тот же порядок, что был раньше. */
function effectiveOrder(c: Category): number {
  return c.sortOrder ?? new Date(c.createdAt).getTime();
}

export async function listCategories(userId: string): Promise<Category[]> {
  const snap = await getDocs(query(categoriesCollection(), where('userId', '==', userId)));
  return snap.docs.map((d) => d.data()).sort((a, b) => effectiveOrder(a) - effectiveOrder(b));
}

export async function createCategory(
  userId: string,
  input: Omit<Category, 'id' | 'userId' | 'createdAt' | 'sortOrder'>,
): Promise<string> {
  const ref = await addDoc(categoriesCollection(), {
    ...input,
    userId,
    sortOrder: Date.now(),
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
