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
import { IconCircle } from '@/components/ui/IconCircle';
import { colorForId } from '@/lib/palette';
import { formatAmount } from '@/lib/format';
import './forms.css';

export function Wallets() {
  const { user } = useOutletContext<{ user: UseAuthResult['user'] }>();
  const { data: wallets, isLoading } = useWallets(user?.uid);
  const createWallet = useCreateWallet(user?.uid);
  const archiveWallet = useArchiveWallet();

  const { register, handleSubmit, reset, formState } = useForm<WalletFormValues>({
    resolver: zodResolver(walletFormSchema),
    defaultValues: { name: '', currency: 'USD' },
  });

  async function onSubmit(values: WalletFormValues) {
    if (!user) return;
    await createWallet.mutateAsync(values);
    reset();
  }

  return (
    <div className="page">
      <h1 className="page__title">Кошельки</h1>

      <section className="neo-card">
        <form className="create-form" onSubmit={handleSubmit(onSubmit)}>
          <div className="field">
            <input className="neo-input" placeholder="Название" {...register('name')} />
            {formState.errors.name && (
              <span className="field__error">{formState.errors.name.message}</span>
            )}
          </div>
          <div className="field">
            <input className="neo-input" placeholder="Валюта" {...register('currency')} />
          </div>
          <button type="submit" className="neo-button neo-button--accent" disabled={createWallet.isPending}>
            Добавить
          </button>
        </form>
      </section>

      <section className="neo-card">
        {isLoading && <p className="state-message">Загрузка...</p>}
        {wallets?.filter((w) => !w.archived).map((w) => (
          <div key={w.id} className="list-row">
            <IconCircle label={w.name} color={w.color ?? colorForId(w.id)} size={36} />
            <div className="list-row__main">
              <div className="list-row__title">{w.name}</div>
              <div className="list-row__subtitle">{w.currency}</div>
            </div>
            <div className="wallet-row__balance">
              <span className="wallet-row__amount">
                {formatAmount(w.balance)} {w.currency}
              </span>
              <button
                type="button"
                className="neo-button neo-button--sm"
                onClick={() => archiveWallet.mutate(w.id)}
              >
                Архивировать
              </button>
            </div>
          </div>
        ))}
        {wallets?.filter((w) => !w.archived).length === 0 && (
          <p className="state-message">Кошельков пока нет</p>
        )}
      </section>
    </div>
  );
}
