import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

const HapticsContext = createContext(null);
const STORAGE_KEY = 'haptics_enabled';

export function HapticsProvider({ children }) {
  const [hapticsEnabled, setHapticsEnabled] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then(val => { if (val !== null) setHapticsEnabled(val === 'true'); })
      .catch(() => {});
  }, []);

  const triggerHaptic = useCallback(() => {
    if (hapticsEnabled && Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
  }, [hapticsEnabled]);

  const toggleHaptics = () => {
    const next = !hapticsEnabled;
    setHapticsEnabled(next);
    AsyncStorage.setItem(STORAGE_KEY, String(next)).catch(() => {});
  };

  return (
    <HapticsContext.Provider value={{ hapticsEnabled, triggerHaptic, toggleHaptics }}>
      {children}
    </HapticsContext.Provider>
  );
}

export const useHaptics = () => useContext(HapticsContext);
