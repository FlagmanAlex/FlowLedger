import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useOutletContext } from 'react-router-dom';
import {
  useArchiveWallet,
  useCreateWallet,
  useWallets,
  walletFormSchema,
  type UseAuthResult,
  type WalletFormValues,
} from '@flowledger/shared';

export function Wallets() {
  const { user } = useOutletContext<{ user: UseAuthResult['user'] }>();
  const { data: wallets, isLoading } = useWallets(user?.tenantId);
  const createWallet = useCreateWallet(user?.tenantId);
  const archiveWallet = useArchiveWallet(user?.tenantId);

  const { register, handleSubmit, reset, formState } = useForm<WalletFormValues>({
    resolver: zodResolver(walletFormSchema),
    defaultValues: { name: '', currency: 'USD' },
  });

  async function onSubmit(values: WalletFormValues) {
    if (!user) return;
    await createWallet.mutateAsync({ ...values, tenantId: user.tenantId });
    reset();
  }

  return (
    <div>
      <h1>Кошельки</h1>

      <form onSubmit={handleSubmit(onSubmit)}>
        <input placeholder="Название" {...register('name')} />
        {formState.errors.name && <span>{formState.errors.name.message}</span>}
        <input placeholder="Валюта" {...register('currency')} />
        <button type="submit" disabled={createWallet.isPending}>Добавить</button>
      </form>

      {isLoading && <p>Загрузка...</p>}
      <ul>
        {wallets?.filter((w) => !w.archived).map((w) => (
          <li key={w.id}>
            {w.name}: {w.balance.toFixed(2)} {w.currency}
            <button type="button" onClick={() => archiveWallet.mutate(w.id)}>Архивировать</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
