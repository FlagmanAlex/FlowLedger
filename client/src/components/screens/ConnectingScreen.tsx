import { useEffect, useState } from 'react';
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
 * Runs once right after control-plane sign-in. Ensures the signed-in
 * customer has their own Firebase project (provisioning it the first time
 * via createCustomerProject — see control-plane/functions), then connects
 * the app to that project and signs the same Google account in there too.
 */
export function ConnectingScreen() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('Проверяем ваше пространство...');
  const [error, setError] = useState<string | null>(null);

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
        const record = snap.data() as CustomerRecord | undefined;

        if (!record || !record.status) {
          setStatus('Создаём ваше персональное облако...');
          try {
            const accessToken = await requestCloudPlatformAccessToken();
            const createCustomerProject = httpsCallable(getControlPlaneFunctions(), 'createCustomerProject');
            await createCustomerProject({ accessToken });
          } catch (err) {
            if (!cancelled) setError(err instanceof Error ? err.message : 'Provisioning failed');
          }
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
          setStatus('Подключаемся к вашему пространству...');
          await initCustomerFirebase(record.firebaseConfig);
          const customerUser = await signInCustomerWithGoogle();

          const existingWorkspace = await getWorkspaceConfig();
          if (!existingWorkspace) {
            await createWorkspaceConfig(customerUser.uid, 'Мой бюджет');
          }

          if (!cancelled) navigate('/', { replace: true });
        }
      });

      return unsubscribe;
    }

    const unsubscribePromise = run();
    return () => {
      cancelled = true;
      unsubscribePromise.then((unsub) => unsub?.());
    };
  }, [navigate]);

  return (
    <div>
      <h1>FlowLedger</h1>
      <p>{status}</p>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
