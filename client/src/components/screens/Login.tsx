import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithGooglePopup } from '@flowledger/shared';
import './Login.css';

export function Login() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSignIn() {
    setError(null);
    setLoading(true);
    try {
      await signInWithGooglePopup();
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-screen">
      <div className="login-badge">FL</div>
      <div>
        <h1 className="login-title">FlowLedger</h1>
        <p className="login-subtitle">Учёт доходов и расходов</p>
      </div>

      <div className="login-form">
        <button
          type="button"
          className="neo-button login-google-button"
          onClick={handleSignIn}
          disabled={loading}
        >
          <span className="login-google-badge">G</span>
          {loading ? 'Вход...' : 'Войти через Google'}
        </button>
        {error && (
          <p className="state-message" role="alert">
            {error}
          </p>
        )}
      </div>

      <p className="login-footnote">Один аккаунт Firebase — веб и мобильное приложение</p>
    </div>
  );
}
