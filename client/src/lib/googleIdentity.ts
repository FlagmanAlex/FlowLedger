/**
 * Google Identity Services (кнопка «Войти через Google») — даёт Google
 * id_token, который сервер обменивает на свою сессию. Скрипт GIS грузится
 * лениво, только на экране входа.
 */

/** Web OAuth-клиент проекта flowledger2 (тот же, что в GOOGLE_CLIENT_IDS
 *  сервера). Не секрет. Можно переопределить через VITE_GOOGLE_CLIENT_ID. */
export const GOOGLE_CLIENT_ID =
  import.meta.env.VITE_GOOGLE_CLIENT_ID ||
  '493091413384-a49q0ufv83sf3gmmihbg27du1et7nedq.apps.googleusercontent.com';

interface GoogleCredentialResponse {
  credential: string;
}

interface GoogleAccountsId {
  initialize(options: {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void;
    ux_mode?: 'popup' | 'redirect';
    auto_select?: boolean;
  }): void;
  renderButton(
    parent: HTMLElement,
    options: {
      type?: 'standard' | 'icon';
      theme?: 'outline' | 'filled_blue' | 'filled_black';
      size?: 'large' | 'medium' | 'small';
      text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
      shape?: 'rectangular' | 'pill' | 'circle' | 'square';
      locale?: string;
      width?: number;
    },
  ): void;
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleAccountsId } };
  }
}

let scriptPromise: Promise<GoogleAccountsId> | undefined;

function loadGis(): Promise<GoogleAccountsId> {
  scriptPromise ??= new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) {
      resolve(window.google.accounts.id);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () =>
      window.google?.accounts?.id
        ? resolve(window.google.accounts.id)
        : reject(new Error('Google Identity Services не загрузился'));
    script.onerror = () => {
      scriptPromise = undefined;
      reject(new Error('Не удалось загрузить вход через Google — проверьте соединение'));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

/** Рисует кнопку Google в parent; onCredential получает id_token. */
export async function renderGoogleButton(
  parent: HTMLElement,
  onCredential: (idToken: string) => void,
  theme: 'light' | 'dark',
): Promise<void> {
  const gis = await loadGis();
  gis.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: (response) => onCredential(response.credential),
    ux_mode: 'popup',
  });
  parent.replaceChildren();
  gis.renderButton(parent, {
    type: 'standard',
    theme: theme === 'dark' ? 'filled_black' : 'outline',
    size: 'large',
    text: 'signin_with',
    shape: 'pill',
    locale: 'ru',
    width: Math.min(parent.clientWidth || 320, 400),
  });
}
