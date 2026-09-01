import { useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { useAcceptInvite, useInvite, type UseAuthResult } from '@flowledger/shared';
import './AcceptInvite.css';

/** Страница /invite/:inviteId — открывается по ссылке-приглашению.
 *  Находится внутри AuthLayout (требует входа), но вне MainLayout — своего
 *  сайдбара/данных пока нет, пользователь ещё не принял приглашение. */
export function AcceptInvite() {
  const { user } = useOutletContext<{ user: UseAuthResult['user'] }>();
  const { inviteId } = useParams<{ inviteId: string }>();
  const navigate = useNavigate();
  const { data: invite, isLoading } = useInvite(inviteId);
  const acceptInvite = useAcceptInvite();
  const [error, setError] = useState<string | null>(null);
  const [now] = useState(() => Date.now());

  async function handleAccept() {
    if (!invite || !user) return;
    setError(null);
    try {
      await acceptInvite.mutateAsync({ invite, acceptor: user });
      navigate('/', { replace: true });
    } catch {
      setError('Не удалось принять приглашение. Возможно, ссылка уже устарела.');
    }
  }

  if (isLoading) {
    return (
      <div className="invite-screen">
        <p className="state-message">Загрузка приглашения...</p>
      </div>
    );
  }

  if (!invite) {
    return (
      <div className="invite-screen">
        <div className="neo-card invite-card">
          <p className="state-message" role="alert">
            Приглашение не найдено. Проверьте ссылку.
          </p>
        </div>
      </div>
    );
  }

  if (invite.ownerId === user?.uid) {
    return (
      <div className="invite-screen">
        <div className="neo-card invite-card">
          <p className="state-message" role="alert">
            Это ваша собственная ссылка-приглашение — отправьте её тому, кому хотите дать доступ.
          </p>
        </div>
      </div>
    );
  }

  const isExpired = invite.status === 'pending' && invite.expiresAt < now;

  if (invite.status === 'accepted') {
    return (
      <div className="invite-screen">
        <div className="neo-card invite-card">
          <p className="state-message">Приглашение уже использовано.</p>
        </div>
      </div>
    );
  }

  if (invite.status === 'revoked' || isExpired) {
    return (
      <div className="invite-screen">
        <div className="neo-card invite-card">
          <p className="state-message" role="alert">
            {isExpired ? 'Срок действия ссылки истёк.' : 'Приглашение отозвано.'} Попросите новую
            ссылку у владельца базы.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="invite-screen">
      <div className="neo-card invite-card">
        <h1 className="page__title">Общий доступ к базе</h1>
        <p className="invite-card__text">
          <strong>{invite.ownerDisplayName}</strong> приглашает вас в общий доступ к своей базе
          FlowLedger — вы сможете видеть и добавлять кошельки, категории и операции наравне с
          владельцем.
        </p>
        {error && (
          <p className="state-message" role="alert">
            {error}
          </p>
        )}
        <button
          type="button"
          className="neo-button neo-button--accent neo-button--full"
          onClick={handleAccept}
          disabled={acceptInvite.isPending}
        >
          {acceptInvite.isPending ? 'Принимаем...' : 'Принять приглашение'}
        </button>
      </div>
    </div>
  );
}
