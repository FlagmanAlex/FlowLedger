import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from '../admin.js';

function signedAmount(type: string, amount: number): number {
  return type === 'expense' ? -Math.abs(amount) : Math.abs(amount);
}

/**
 * Keeps wallets.balance denormalized so the dashboard can read it without an
 * aggregation query, and so offline clients never have to compute it
 * themselves before syncing.
 */
export const onTransactionWritten = onDocumentWritten(
  'transactions/{transactionId}',
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();

    const deltas = new Map<string, number>();

    if (before) {
      const delta = -signedAmount(before.type, before.amount);
      deltas.set(before.walletId, (deltas.get(before.walletId) ?? 0) + delta);
    }
    if (after) {
      const delta = signedAmount(after.type, after.amount);
      deltas.set(after.walletId, (deltas.get(after.walletId) ?? 0) + delta);
    }

    await Promise.all(
      Array.from(deltas.entries()).map(([walletId, delta]) =>
        delta === 0
          ? Promise.resolve()
          : db.collection('wallets').doc(walletId).update({
              balance: FieldValue.increment(delta),
            }),
      ),
    );
  },
);
