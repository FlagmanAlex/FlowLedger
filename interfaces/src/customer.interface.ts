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

/** Durable per-step checkpoints of the provisioning pipeline
 *  (control-plane createCustomerProject). A step marked true is already
 *  reflected in the real state of the customer's Google/Firebase project,
 *  so a resumed run skips straight past it. */
export type ProvisioningSteps = Partial<Record<ProvisioningStep, boolean>>;

/** control-plane's `customers/{uid}` record — tracks the customer's own
 *  Firebase project (created for them via createCustomerProject). */
export interface CustomerRecord {
  status: ProvisioningStatus;
  projectId?: string;
  firebaseConfig?: FirebaseWebAppConfig;
  error?: string;
  createdAt?: string;
  readyAt?: string;
  /** Heartbeat of the last pipeline write; also used to detect concurrent
   *  runs and to notice a dead run (stale heartbeat → resume allowed). */
  updatedAt?: string;
  steps?: ProvisioningSteps;
}
