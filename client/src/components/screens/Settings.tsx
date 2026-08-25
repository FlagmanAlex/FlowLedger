import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useOutletContext } from 'react-router-dom';
import {
  getCustomerAuth,
  inviteFormSchema,
  useInviteMember,
  type InviteFormValues,
  type UseAuthResult,
} from '@flowledger/shared';

export function Settings() {
  const { user } = useOutletContext<{ user: UseAuthResult['user'] }>();
  const inviteMember = useInviteMember();
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  const { register, handleSubmit, reset, formState } = useForm<InviteFormValues>({
    resolver: zodResolver(inviteFormSchema),
  });

  async function onSubmit(values: InviteFormValues) {
    await inviteMember.mutateAsync(values.email);

    const app = getCustomerAuth().app;
    const config = {
      apiKey: app.options.apiKey,
      authDomain: app.options.authDomain,
      projectId: app.options.projectId,
      storageBucket: app.options.storageBucket,
      messagingSenderId: app.options.messagingSenderId,
      appId: app.options.appId,
    };
    const encoded = btoa(JSON.stringify(config));
    setInviteLink(`${window.location.origin}/join?config=${encoded}`);
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
        {inviteLink && (
          <p>
            Отправьте эту ссылку приглашённому: <br />
            <code>{inviteLink}</code>
          </p>
        )}
      </section>
    </div>
  );
}
