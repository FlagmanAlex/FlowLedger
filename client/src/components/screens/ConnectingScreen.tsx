import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import type { CustomerRecord } from '@flowledger/interfaces';
import {
  createWorkspaceConfig,
  getControlPlaneAuth,
  getControlPlaneFirestore,
  getControlPlaneFunctions,
  getWorkspaceConfig,
  initCustomerFirebase,
  requestCloudPlatformAccessToken,
  signInCustomerWithGoogle,
} from '@flowledger/shared';

/**
 * Запускается один раз сразу после входа в контрольную плоскость.
 * Убеждается, что у вошедшего покупателя есть собственный Firebase-проект
 * (при первом входе провижинится через createCustomerProject — см.
 * control-plane/functions), затем подключает приложение к этому проекту и
 * подписывает в него тот же Google-аккаунт.
 */
type PendingAction = 'provision' | 'connect';

export function ConnectingScreen() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('Проверяем ваше пространство...');
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction>('provision');
  const lastReadyRecord = useRef<
    (CustomerRecord & { firebaseConfig: NonNullable<CustomerRecord['firebaseConfig']> }) | null
  >(null);

  const reportPopupOrGenericError = (err: unknown, genericFallback: string) => {
    const code = (err as { code?: string } | null)?.code;
    if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
      // Попап открыт вне пользовательского жеста (автозапуск из onSnapshot) —
      // повторный запуск по клику кнопки браузер уже не блокирует.
      setError('Браузер заблокировал окно Google. Нажмите «Повторить» — окно откроется по вашему клику.');
    } else if (code === 'functions/not-found') {
      setError('Функция провижининга ещё не развёрнута в контрольном проекте (шаг деплоя Cloud Functions).');
    } else {
      setError(err instanceof Error ? err.message : genericFallback);
    }
  };

  /** Вызывает функцию провижининга. Безопасно повторять (в том числе вручную,
   *  кнопкой «Повторить»): бэкенд идемпотентен по шагам и продолжает работу
   *  с последнего завершённого чекпоинта, а не начинает заново. */
  const startProvisioning = useCallback(async () => {
    try {
      const accessToken = await requestCloudPlatformAccessToken();
      const createCustomerProject = httpsCallable(getControlPlaneFunctions(), 'createCustomerProject');
      await createCustomerProject({ accessToken });
    } catch (err) {
      setPendingAction('provision');
      reportPopupOrGenericError(err, 'Provisioning failed');
    }
  }, []);

  /** Подключает клиента к уже готовому проекту покупателя. Отдельно от
   *  startProvisioning, потому что может понадобиться повторить только этот
   *  шаг (например, если браузер заблокировал попап входа именно здесь). */
  const connectToWorkspace = useCallback(
    async (record: CustomerRecord & { firebaseConfig: NonNullable<CustomerRecord['firebaseConfig']> }) => {
      try {
        setStatus('Подключаемся к вашему пространству...');
        await initCustomerFirebase(record.firebaseConfig);
        const customerUser = await signInCustomerWithGoogle();

        const existingWorkspace = await getWorkspaceConfig();
        if (!existingWorkspace) {
          await createWorkspaceConfig(customerUser.uid, 'Мой бюджет');
        }

        navigate('/', { replace: true });
      } catch (err) {
        setPendingAction('connect');
        reportPopupOrGenericError(err, 'Не удалось подключиться к вашему пространству');
      }
    },
    [navigate],
  );

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const controlUser = getControlPlaneAuth().currentUser;
      if (!controlUser) {
        navigate('/login', { replace: true });
        return;
      }

      const customerRef = doc(getControlPlaneFirestore(), 'customers', controlUser.uid);

      const unsubscribe = onSnapshot(customerRef, async (snap) => {
        if (cancelled) return;
        const record = snap.data() as CustomerRecord | undefined;

        if (!record || !record.status) {
          setStatus('Создаём ваше персональное облако...');
          await startProvisioning();
          return;
        }

        if (record.status === 'provisioning') {
          setStatus('Создаём ваше персональное облако...');
          return;
        }

        if (record.status === 'failed') {
          setError(record.error ?? 'Provisioning failed');
          return;
        }

        if (record.status === 'ready' && record.firebaseConfig) {
          lastReadyRecord.current = record as CustomerRecord & {
            firebaseConfig: NonNullable<CustomerRecord['firebaseConfig']>;
          };
          await connectToWorkspace(lastReadyRecord.current);
        }
      });

      return unsubscribe;
    }

    const unsubscribePromise = run();
    return () => {
      cancelled = true;
      unsubscribePromise.then((unsub) => unsub?.());
    };
  }, [navigate, startProvisioning, connectToWorkspace]);

  /** Ручной перезапуск после показанной ошибки: бэкенд/подключение продолжают
   *  с того же шага, на котором упали, — какой именно, помнит pendingAction. */
  const retryProvisioning = async () => {
    setRetrying(true);
    setError(null);
    if (pendingAction === 'connect' && lastReadyRecord.current) {
      await connectToWorkspace(lastReadyRecord.current);
    } else {
      await startProvisioning();
    }
    setRetrying(false);
  };

  return (
    <div>
      <h1>FlowLedger</h1>
      <p>{status}</p>
      {error && (
        <div role="alert">
          <p>{error}</p>
          <button type="button" onClick={retryProvisioning} disabled={retrying}>
            {retrying ? 'Повторяем...' : 'Повторить'}
          </button>
        </div>
      )}
    </div>
  );
}
