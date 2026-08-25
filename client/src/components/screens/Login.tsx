import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInControlPlaneWithGoogle } from '@flowledger/shared';

export function Login() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSignIn() {
    setError(null);
    setLoading(true);
    try {
      await signInControlPlaneWithGoogle();
      navigate('/connecting');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h1>FlowLedger</h1>
      <p>Учёт доходов и расходов</p>
      <button type="button" onClick={handleSignIn} disabled={loading}>
        {loading ? 'Вход...' : 'Войти через Google'}
      </button>
      {error && <p role="alert">{error}</p>}
      <p>
        Получили ссылку-приглашение? <a href="/join">Присоединиться к бюджету</a>
      </p>
    </div>
  );
}
