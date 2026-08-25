import {
  type CollectionReference,
  type DocumentData,
  type DocumentReference,
  type FirestoreDataConverter,
  collection,
  doc,
} from 'firebase/firestore';
import type { Category, Transaction, Wallet, WorkspaceConfig } from '@flowledger/interfaces';
import { getCustomerFirestore } from '../firebase/customer.js';

function converter<T extends DocumentData>(): FirestoreDataConverter<T> {
  return {
    toFirestore: (data) => data as DocumentData,
    fromFirestore: (snap) => ({ id: snap.id, ...snap.data() }) as unknown as T,
  };
}

export function walletsCollection(): CollectionReference<Wallet> {
  return collection(getCustomerFirestore(), 'wallets').withConverter(converter<Wallet>());
}

export function categoriesCollection(): CollectionReference<Category> {
  return collection(getCustomerFirestore(), 'categories').withConverter(converter<Category>());
}

export function transactionsCollection(): CollectionReference<Transaction> {
  return collection(getCustomerFirestore(), 'transactions').withConverter(
    converter<Transaction>(),
  );
}

export function workspaceConfigDoc(): DocumentReference<WorkspaceConfig> {
  return doc(getCustomerFirestore(), 'workspace', 'config').withConverter(
    converter<WorkspaceConfig>(),
  );
}
