import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useDashboard } from '@flowledger/shared';
import { useAuthUser } from '../navigation/AuthContext';

export function DashboardScreen() {
  const { user } = useAuthUser();
  const { summary, isLoading } = useDashboard(Boolean(user));

  if (isLoading || !summary) {
    return (
      <View style={styles.center}>
        <Text>Загрузка...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Общий баланс: {summary.totalBalance.toFixed(2)}</Text>
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
