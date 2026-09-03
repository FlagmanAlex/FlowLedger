import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  completeGoogleRedirectSignIn,
  signInWithGooglePopup,
  signInWithGoogleRedirect,
} from '@flowledger/shared';
import './Login.css';

// Ставим перед уходом на страницу Google (запасной путь через редирект,
// см. handleSignIn) и снимаем после возврата — так отличаем «обычное
// первое открытие /login» (getRedirectResult() уже корректно резолвится
// в null) от «вернулись с Google, а результата нет» (тоже null, но это
// сбой, а не норма) — второй случай без этого флага проходил бы вообще
// без обратной связи для пользователя.
const REDIRECT_PENDING_KEY = 'fl_google_redirect_pending';

function errorCode(err: unknown): string | undefined {
  return err && typeof err === 'object' && 'code' in err ? String((err as { code: unknown }).code) : undefined;
}

export function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);

  const from = (location.state as { from?: { pathname: string; search: string } } | null)?.from;

  // Забираем результат signInWithGoogleRedirect после возврата со страницы
  // Google, если основной путь (попап) упал на запасной.
  useEffect(() => {
    let cancelled = false;
    const wasPending = sessionStorage.getItem(REDIRECT_PENDING_KEY) === '1';
    completeGoogleRedirectSignIn()
      .then((user) => {
        if (cancelled) return;
        sessionStorage.removeItem(REDIRECT_PENDING_KEY);
        if (user) {
          navigate(from ? `${from.pathname}${from.search}` : '/', { replace: true });
        } else if (wasPending) {
          console.error('Google redirect sign-in: getRedirectResult() вернул null после возврата с Google');
          setError('Не удалось завершить вход через Google — попробуйте ещё раз.');
        }
      })
      .catch((err) => {
        if (cancelled) return;
        sessionStorage.removeItem(REDIRECT_PENDING_KEY);
        console.error('Google redirect sign-in failed', err);
        setError(err instanceof Error ? err.message : 'Sign-in failed');
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSignIn() {
    setError(null);
    setSigningIn(true);
    try {
      await signInWithGooglePopup();
      navigate(from ? `${from.pathname}${from.search}` : '/', { replace: true });
      return;
    } catch (err) {
      const code = errorCode(err);

      // Пользователь сам закрыл окно Google — не ошибка, просто молча ждём.
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        setSigningIn(false);
        return;
      }

      // Попап реально не открылся (заблокирован браузером/окружением) —
      // единственный случай, где имеет смысл редирект как запасной путь.
      if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
        try {
          sessionStorage.setItem(REDIRECT_PENDING_KEY, '1');
          await signInWithGoogleRedirect();
          return;
        } catch (redirectErr) {
          sessionStorage.removeItem(REDIRECT_PENDING_KEY);
          console.error('Google redirect fallback failed', redirectErr);
          setError(redirectErr instanceof Error ? redirectErr.message : 'Sign-in failed');
          setSigningIn(false);
          return;
        }
      }

      console.error('Google popup sign-in failed', err);
      setError(err instanceof Error ? err.message : 'Sign-in failed');
      setSigningIn(false);
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
          disabled={signingIn}
        >
          <span className="login-google-badge">G</span>
          {signingIn ? 'Вход...' : 'Войти через Google'}
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
