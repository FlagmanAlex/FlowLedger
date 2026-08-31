import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useTransactions } from '@flowledger/shared';
import { useAuthUser } from '../navigation/AuthContext';

/**
 * Firestore's persistent local cache means this list renders from disk
 * instantly offline, and any transactions created while offline show up
 * here immediately (metadata.hasPendingWrites can drive a "not synced yet"
 * badge once wired into the transactions repo).
 */
export function TransactionsScreen() {
  const { user } = useAuthUser();
  const { data: transactions, isLoading } = useTransactions(user?.uid);

  return (
    <View style={styles.container}>
      {isLoading && <Text>Загрузка...</Text>}
      <FlatList
        data={transactions}
        keyExtractor={(t) => t.id}
        renderItem={({ item }) => (
          <Text>
            {item.date} — {item.type === 'expense' ? '-' : '+'}
            {Math.abs(item.amount).toFixed(2)} — {item.description}
          </Text>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
});
