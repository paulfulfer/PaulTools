import React from 'react';
import { View, Text } from 'react-native';
import * as Updates from 'expo-updates';
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

  const updateLabel = Updates.updateId
    ? `upd: ${Updates.updateId.slice(0, 8)}`
    : 'upd: local';

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bgBase, overflow: 'hidden' }}>
      <BackgroundOrbs />
      <AuthProvider>
        <StatusBarController />
        <RootNavigator />
      </AuthProvider>
      {/* ── Temporary OTA update indicator — remove after confirming delivery ── */}
      <Text style={{
        position: 'absolute', bottom: 8, alignSelf: 'center',
        color: 'rgba(255,255,255,0.4)', fontSize: 10,
        fontFamily: 'Inter_400Regular', letterSpacing: 0.5,
        pointerEvents: 'none', zIndex: 9999,
      }}>
        {updateLabel}
      </Text>
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
