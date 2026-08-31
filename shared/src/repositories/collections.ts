import {
  type CollectionReference,
  type DocumentData,
  type FirestoreDataConverter,
  collection,
} from 'firebase/firestore';
import type { Category, Transaction, Wallet } from '@flowledger/interfaces';
import { getFirestoreInstance } from '../firebase/firebase.js';

function converter<T extends DocumentData>(): FirestoreDataConverter<T> {
  return {
    toFirestore: (data) => data as DocumentData,
    fromFirestore: (snap) => ({ id: snap.id, ...snap.data() }) as unknown as T,
  };
}

export function walletsCollection(): CollectionReference<Wallet> {
  return collection(getFirestoreInstance(), 'wallets').withConverter(converter<Wallet>());
}

export function categoriesCollection(): CollectionReference<Category> {
  return collection(getFirestoreInstance(), 'categories').withConverter(converter<Category>());
}

export function transactionsCollection(): CollectionReference<Transaction> {
  return collection(getFirestoreInstance(), 'transactions').withConverter(
    converter<Transaction>(),
  );
}
