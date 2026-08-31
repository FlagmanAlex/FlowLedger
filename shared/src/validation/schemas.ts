import { z } from 'zod';

export const walletFormSchema = z.object({
  name: z.string().min(1, 'Required'),
  currency: z.string().min(1, 'Required'),
  icon: z.string().optional(),
  color: z.string().optional(),
});
export type WalletFormValues = z.infer<typeof walletFormSchema>;

export const categoryFormSchema = z.object({
  name: z.string().min(1, 'Required'),
  type: z.enum(['income', 'expense']),
  icon: z.string().optional(),
  color: z.string().optional(),
  parentId: z.string().optional(),
});
export type CategoryFormValues = z.infer<typeof categoryFormSchema>;

export const transactionFormSchema = z.object({
  walletId: z.string().min(1, 'Required'),
  categoryId: z.string().min(1, 'Required'),
  type: z.enum(['income', 'expense', 'transfer']),
  amount: z.coerce.number().positive('Must be greater than 0'),
  description: z.string().optional(),
  date: z.string().min(1, 'Required'),
});
export type TransactionFormValues = z.infer<typeof transactionFormSchema>;
