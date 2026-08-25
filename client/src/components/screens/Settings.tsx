import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useOutletContext } from 'react-router-dom';
import { inviteFormSchema, type InviteFormValues, type UseAuthResult } from '@flowledger/shared';
import { getFunctions, httpsCallable } from 'firebase/functions';

export function Settings() {
  const { user } = useOutletContext<{ user: UseAuthResult['user'] }>();
  const { register, handleSubmit, reset, formState } = useForm<InviteFormValues>({
    resolver: zodResolver(inviteFormSchema),
  });

  async function onSubmit(values: InviteFormValues) {
    const createInvite = httpsCallable(getFunctions(), 'createInvite');
    await createInvite(values);
    reset();
  }

  return (
    <div>
      <h1>Настройки</h1>

      <section>
        <h2>Профиль</h2>
        <p>{user?.displayName} ({user?.email})</p>
        <p>Роль: {user?.role}</p>
      </section>

      <section>
        <h2>Пригласить участника</h2>
        <form onSubmit={handleSubmit(onSubmit)}>
          <input placeholder="Email" {...register('email')} />
          {formState.errors.email && <span>{formState.errors.email.message}</span>}
          <button type="submit" disabled={formState.isSubmitting}>Пригласить</button>
        </form>
      </section>
    </div>
  );
}
