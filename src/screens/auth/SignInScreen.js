import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';

export default function SignInScreen() {
  const { theme, isDark, toggleTheme } = useTheme();
  const { signInWithGoogle } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      Alert.alert('Sign-in failed', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bgBase }]}>
      <TouchableOpacity style={styles.themeBtn} onPress={toggleTheme}>
        <Text style={{ fontSize: 22 }}>{isDark ? '🌙' : '☀️'}</Text>
      </TouchableOpacity>

      <View
        style={[
          styles.card,
          {
            backgroundColor: theme.colors.bgCard,
            borderColor: theme.colors.borderSubtle,
          },
        ]}
      >
        <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
          Paul's Tools
        </Text>
        <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
          Sign in to access your personal dashboard
        </Text>

        <TouchableOpacity
          style={[styles.googleBtn, { opacity: loading ? 0.6 : 1 }]}
          onPress={handleSignIn}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Text style={styles.googleBtnG}>G</Text>
              <Text style={styles.googleBtnLabel}>Sign in with Google</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  themeBtn: {
    position: 'absolute',
    top: 56,
    right: 24,
    padding: 8,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 24,
    borderWidth: 1,
    padding: 36,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 4,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 28,
  },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#2563eb',
    minHeight: 50,
  },
  googleBtnG: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '800',
  },
  googleBtnLabel: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});
