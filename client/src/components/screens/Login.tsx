import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { signInWithGoogleIdToken } from '@flowledger/shared';
import { renderGoogleButton } from '@/lib/googleIdentity';
import { getStoredTheme } from '@/lib/theme';
import './Login.css';

/** Вход: кнопка Google Identity Services → Google id_token → сессия на
 *  нашем сервере (POST /api/auth/google). */
export function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const buttonRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);

  const from = (location.state as { from?: { pathname: string; search: string } } | null)?.from;

  useEffect(() => {
    const parent = buttonRef.current;
    if (!parent) return;

    async function handleCredential(idToken: string) {
      setError(null);
      setSigningIn(true);
      try {
        await signInWithGoogleIdToken(idToken);
        navigate(from ? `${from.pathname}${from.search}` : '/', { replace: true });
      } catch (err) {
        console.error('Вход через Google не удался', err);
        setError(err instanceof Error ? err.message : 'Не удалось войти');
        setSigningIn(false);
      }
    }

    renderGoogleButton(parent, (idToken) => void handleCredential(idToken), getStoredTheme()).catch(
      (err: unknown) => {
        console.error('Google Identity Services', err);
        setError(err instanceof Error ? err.message : 'Не удалось загрузить вход через Google');
      },
    );
    // from/navigate стабильны в пределах экрана входа.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="login-screen">
      <div className="login-badge">FL</div>
      <div>
        <h1 className="login-title">FlowLedger</h1>
        <p className="login-subtitle">Учёт доходов и расходов</p>
      </div>

      <div className="login-form">
        <div ref={buttonRef} className="login-google-button" hidden={signingIn} />
        {signingIn && <p className="state-message">Вход...</p>}
        {error && (
          <p className="state-message" role="alert">
            {error}
          </p>
        )}
      </div>

      <p className="login-footnote">Один аккаунт Google — веб и мобильное приложение</p>
    </div>
  );
}
