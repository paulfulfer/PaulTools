import React from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { AuthProvider } from './src/context/AuthContext';
import { HapticsProvider } from './src/context/HapticsContext';
import BackgroundOrbs from './src/components/BackgroundOrbs';
import RootNavigator from './src/navigation';

function StatusBarController() {
  const { isDark } = useTheme();
  return <StatusBar style={isDark ? 'light' : 'dark'} />;
}

// Solid base colour + orbs — all screens sit transparently on top of this.
function AppRoot() {
  const { theme } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bgBase, overflow: 'hidden' }}>
      <BackgroundOrbs />
      <AuthProvider>
        <StatusBarController />
        <RootNavigator />
      </AuthProvider>
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <HapticsProvider>
          <AppRoot />
        </HapticsProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
