import { useEffect, useState } from 'react';
import { Button, StyleSheet, Text, View } from 'react-native';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import Constants from 'expo-constants';
import { signInWithGoogleIdToken } from '@flowledger/shared';

WebBrowser.maybeCompleteAuthSession();

const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, string | undefined>;

/**
 * Требует googleWebClientId в app.json → expo.extra (OAuth-клиент типа
 * "Web application" в Google Cloud Console того же проекта, что и Firebase —
 * signInWithGoogleIdToken() проверяет id_token именно от него). Не
 * протестировано на реальном устройстве в этой сессии — нужна ручная
 * проверка после того, как клиент будет создан в консоли (см.
 * docs/FIREBASE_SETUP.md).
 */
export function LoginScreen() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId: extra.googleWebClientId,
  });

  useEffect(() => {
    if (response?.type !== 'success') return;

    const idToken = response.params?.id_token;
    if (!idToken) {
      setError('Google не вернул id_token.');
      return;
    }

    setLoading(true);
    setError(null);
    signInWithGoogleIdToken(idToken)
      .catch((err) => setError(err instanceof Error ? err.message : 'Sign-in failed'))
      .finally(() => setLoading(false));
  }, [response]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>FlowLedger</Text>
      <Text>Учёт доходов и расходов</Text>
      <Button
        title={loading ? 'Вход...' : 'Войти через Google'}
        disabled={!request || loading}
        onPress={() => promptAsync()}
      />
      {error && <Text>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  title: { fontSize: 24, fontWeight: 'bold' },
});
