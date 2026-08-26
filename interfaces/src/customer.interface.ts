export interface FirebaseWebAppConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

export type ProvisioningStatus = 'provisioning' | 'ready' | 'failed';

export type ProvisioningStep =
  | 'projectCreated'
  | 'servicesEnabled'
  | 'firebaseAdded'
  | 'firestoreCreated'
  | 'webAppCreated'
  | 'signInEnabled'
  | 'rulesDeployed'
  | 'indexesDeployed';

/** Долговременные почаговые чекпоинты конвейера провижининга
 *  (control-plane createCustomerProject). Шаг, помеченный true, уже отражён
 *  в реальном состоянии Google/Firebase-проекта покупателя, поэтому
 *  возобновлённый запуск перепрыгивает его сразу. */
export type ProvisioningSteps = Partial<Record<ProvisioningStep, boolean>>;

/** Запись `customers/{uid}` контрольной плоскости — хранит информацию о собственном
 *  Firebase-проекте покупателя (создаётся для него через createCustomerProject). */
export interface CustomerRecord {
  status: ProvisioningStatus;
  projectId?: string;
  firebaseConfig?: FirebaseWebAppConfig;
  error?: string;
  createdAt?: string;
  readyAt?: string;
  /** Heartbeat последней записи конвейера; также служит для обнаружения
   *  параллельных запусков и «мертвого» запуска (протухший heartbeat →
   *  разрешено возобновление). */
  updatedAt?: string;
  steps?: ProvisioningSteps;
}
