import { useState } from 'react';
import { Button, StyleSheet, Text, TextInput, View } from 'react-native';
import type { FirebaseWebAppConfig } from '@flowledger/interfaces';
import { acceptWorkspaceInvite, initCustomerFirebase, signInCustomerWithGoogle } from '@flowledger/shared';

/**
 * Auto-provisioning (control-plane OAuth + createCustomerProject) needs a
 * native Google Sign-In flow with elevated scopes that isn't wired yet —
 * see LoginScreen's TODO. Until then, mobile connects to a workspace by
 * pasting the invite/connection link generated on the web app (Settings →
 * "Пригласить участника"), same config-in-the-link mechanism as
 * client/src/components/screens/JoinScreen.tsx.
 */
export function ConnectScreen() {
  const [link, setLink] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleConnect() {
    setError(null);
    setLoading(true);
    try {
      const url = new URL(link.trim());
      const encoded = url.searchParams.get('config');
      if (!encoded) throw new Error('Ссылка не содержит параметр config.');
      const config = JSON.parse(atob(encoded)) as FirebaseWebAppConfig;

      await initCustomerFirebase(config);
      const user = await signInCustomerWithGoogle();
      await acceptWorkspaceInvite(user.uid);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось подключиться');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Подключение к бюджету</Text>
      <Text>Вставьте ссылку-приглашение, полученную в веб-версии FlowLedger.</Text>
      <TextInput
        style={styles.input}
        value={link}
        onChangeText={setLink}
        placeholder="https://.../join?config=..."
        autoCapitalize="none"
      />
      <Button title={loading ? 'Подключение...' : 'Подключиться'} onPress={handleConnect} disabled={loading} />
      {error && <Text>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 16 },
  title: { fontSize: 24, fontWeight: 'bold' },
  input: { borderWidth: 1, borderColor: '#ccc', padding: 8, width: '100%' },
});
