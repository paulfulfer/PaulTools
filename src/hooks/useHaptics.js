import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';

const STORAGE_KEY = 'haptics_enabled';

/**
 * Reads 'haptics_enabled' from AsyncStorage and exposes a stable
 * triggerHaptic() that fires Haptics.impactAsync(Light) only when enabled.
 * Uses an internal ref so triggerHaptic() is safe inside useCallback([]).
 */
export function useHaptics() {
  const [enabled, setEnabled] = useState(true);
  const enabledRef = useRef(true);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then(val => {
        if (val !== null) {
          const on = val === 'true';
          setEnabled(on);
          enabledRef.current = on;
        }
      })
      .catch(() => {});
  }, []);

  // Stable reference — safe to call from any useCallback(fn, [])
  const triggerHaptic = useCallback(() => {
    if (enabledRef.current && Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
  }, []);

  return { triggerHaptic, hapticsEnabled: enabled };
}
