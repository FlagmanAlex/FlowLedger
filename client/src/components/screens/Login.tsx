import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  completeGoogleRedirectSignIn,
  signInWithGooglePopup,
  signInWithGoogleRedirect,
} from '@flowledger/shared';
import './Login.css';

/** Попапы Google-логина ненадёжны на мобильных браузерах (часто дают
 *  auth/network-request-failed вместо реального сбоя сети) — там
 *  используем редирект на страницу Google вместо всплывающего окна. */
function isMobileBrowser(): boolean {
  const nav = navigator as Navigator & { userAgentData?: { mobile?: boolean } };
  if (nav.userAgentData) return Boolean(nav.userAgentData.mobile);
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

// Ставим перед уходом на страницу Google и снимаем после возврата — так
// отличаем «обычное первое открытие /login» (getRedirectResult() уже
// корректно резолвится в null) от «вернулись с Google, а результата нет»
// (getRedirectResult() тоже резолвится в null, но это баг/сбой, а не
// норма) — второй случай без этого флага проходил бы вообще без обратной
// связи для пользователя.
const REDIRECT_PENDING_KEY = 'fl_google_redirect_pending';

export function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);

  const from = (location.state as { from?: { pathname: string; search: string } } | null)?.from;

  // Забираем результат signInWithGoogleRedirect после возврата со страницы
  // Google — на обычном первом открытии экрана (без ожидающего редиректа)
  // резолвится в null почти мгновенно, поэтому кнопку этим не блокируем.
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
      if (isMobileBrowser()) {
        sessionStorage.setItem(REDIRECT_PENDING_KEY, '1');
        await signInWithGoogleRedirect();
        return;
      }
      await signInWithGooglePopup();
      navigate(from ? `${from.pathname}${from.search}` : '/', { replace: true });
    } catch (err) {
      sessionStorage.removeItem(REDIRECT_PENDING_KEY);
      console.error('Google sign-in failed', err);
      setError(err instanceof Error ? err.message : 'Sign-in failed');
    } finally {
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
