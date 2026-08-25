import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { FirebaseWebAppConfig } from '@flowledger/interfaces';
import {
  acceptWorkspaceInvite,
  initCustomerFirebase,
  signInCustomerWithGoogle,
} from '@flowledger/shared';

/**
 * Landing page for an invite link generated in Settings ("Пригласить
 * участника") — the link carries the owner's Firebase project config
 * (public, non-secret identifiers) so this device can connect directly to
 * their project without any control-plane involvement.
 */
export function JoinScreen() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleJoin() {
    setError(null);
    setLoading(true);
    try {
      const encoded = searchParams.get('config');
      if (!encoded) throw new Error('Invite link is missing its config parameter.');
      const config = JSON.parse(atob(encoded)) as FirebaseWebAppConfig;

      await initCustomerFirebase(config);
      const user = await signInCustomerWithGoogle();
      await acceptWorkspaceInvite(user.uid);

      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h1>Присоединиться к бюджету</h1>
      <p>Вас пригласили в общий бюджет FlowLedger. Войдите тем же Google-аккаунтом, на который пришло приглашение.</p>
      <button type="button" onClick={handleJoin} disabled={loading}>
        {loading ? 'Подключение...' : 'Войти через Google и присоединиться'}
      </button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
