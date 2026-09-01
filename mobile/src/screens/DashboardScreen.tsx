import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useDashboard } from '@flowledger/shared';
import { useAuthUser } from '../navigation/AuthContext';

export function DashboardScreen() {
  const { user } = useAuthUser();
  const { summary, isLoading } = useDashboard(user?.uid);

  if (isLoading || !summary) {
    return (
      <View style={styles.center}>
        <Text>Загрузка...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {summary.totalBalanceByCurrency.map((b) => (
        <Text key={b.currency} style={styles.title}>
          Общий баланс: {b.total.toFixed(2)} {b.currency}
        </Text>
      ))}
      <FlatList
        data={summary.wallets}
        keyExtractor={(w) => w.walletId}
        renderItem={({ item }) => (
          <Text>
            {item.walletName}: {item.balance.toFixed(2)} {item.currency}
          </Text>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: 'bold' },
});
