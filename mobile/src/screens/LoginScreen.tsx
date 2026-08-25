import { useState } from 'react';
import { Button, StyleSheet, Text, View } from 'react-native';

/**
 * Web uses signInWithPopup (@flowledger/shared's signInWithGoogleWeb);
 * native needs an Expo-compatible Google flow (expo-auth-session or
 * @react-native-google-signin/google-signin) wired to Firebase Auth via
 * signInWithCredential — left as a TODO until Google OAuth client IDs are
 * provisioned for Android/iOS in the Firebase console.
 */
export function LoginScreen() {
  const [error] = useState<string | null>(null);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>FlowLedger</Text>
      <Text>Учёт доходов и расходов</Text>
      <Button
        title="Войти через Google"
        onPress={() => {
          throw new Error('TODO: wire native Google Sign-In to Firebase Auth');
        }}
      />
      {error && <Text>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  title: { fontSize: 24, fontWeight: 'bold' },
});
