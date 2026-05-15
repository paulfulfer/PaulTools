import React from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { AuthProvider } from './src/context/AuthContext';
import { HapticsProvider } from './src/context/HapticsContext';
import BackgroundOrbs from './src/components/BackgroundOrbs';
import RootNavigator from './src/navigation';

function StatusBarController() {
  const { isDark } = useTheme();
  return <StatusBar style={isDark ? 'light' : 'dark'} />;
}

function AppRoot() {
  const { theme } = useTheme();

  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  // Hold a solid background while fonts are loading — same colour as the app base
  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: theme.colors.bgBase }} />;
  }

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
