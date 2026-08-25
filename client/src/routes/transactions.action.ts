import type { ActionFunctionArgs } from 'react-router-dom';
import { createTransaction, getCustomerAuth } from '@flowledger/shared';
import type { TransactionType } from '@flowledger/interfaces';

export async function transactionsAction({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const user = getCustomerAuth().currentUser;
  if (!user) return null;

  await createTransaction({
    walletId: String(formData.get('walletId')),
    categoryId: String(formData.get('categoryId')),
    type: String(formData.get('type')) as TransactionType,
    amount: Number(formData.get('amount')),
    description: String(formData.get('description') ?? ''),
    date: String(formData.get('date')),
    createdBy: user.uid,
  });

  return null;
}
