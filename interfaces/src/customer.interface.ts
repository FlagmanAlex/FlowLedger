export interface FirebaseWebAppConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

export type ProvisioningStatus = 'provisioning' | 'ready' | 'failed';

/** control-plane's `customers/{uid}` record — tracks the customer's own
 *  Firebase project (created for them via createCustomerProject). */
export interface CustomerRecord {
  status: ProvisioningStatus;
  projectId?: string;
  firebaseConfig?: FirebaseWebAppConfig;
  error?: string;
  createdAt?: string;
  readyAt?: string;
}
