import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

export default function AcademicPlannerScreen() {
  const { theme } = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: theme.colors.bgBase }]}>
      <Text style={styles.icon}>🎓</Text>
      <Text style={[styles.title, { color: theme.colors.textPrimary }]}>Academic Planner</Text>
      <Text style={[styles.sub, { color: theme.colors.textMuted }]}>Coming soon</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  icon: { fontSize: 52, marginBottom: 4 },
  title: { fontSize: 22, fontWeight: '700', letterSpacing: -0.4 },
  sub: { fontSize: 14 },
});
