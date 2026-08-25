import {
  type CollectionReference,
  type DocumentData,
  type FirestoreDataConverter,
  collection,
} from 'firebase/firestore';
import type { Category, Transaction, Wallet } from '@flowledger/interfaces';
import { getFirebaseFirestore } from '../firebase/app.js';

function converter<T extends DocumentData>(): FirestoreDataConverter<T> {
  return {
    toFirestore: (data) => data as DocumentData,
    fromFirestore: (snap) => ({ id: snap.id, ...snap.data() }) as unknown as T,
  };
}

export function walletsCollection(): CollectionReference<Wallet> {
  return collection(getFirebaseFirestore(), 'wallets').withConverter(converter<Wallet>());
}

export function categoriesCollection(): CollectionReference<Category> {
  return collection(getFirebaseFirestore(), 'categories').withConverter(converter<Category>());
}

export function transactionsCollection(): CollectionReference<Transaction> {
  return collection(getFirebaseFirestore(), 'transactions').withConverter(
    converter<Transaction>(),
  );
}
