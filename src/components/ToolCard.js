import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';

export default function ToolCard({ title, description, icon, accent, onPress }) {
  const { theme } = useTheme();
  const accentColor = theme.colors[accent] ?? theme.colors.blue;
  const accentGlow = theme.colors[`${accent}Glow`] ?? theme.colors.blueGlow;

  return (
    <TouchableOpacity
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.bgCard,
          borderColor: theme.colors.borderSubtle,
          shadowOpacity: theme.dark ? 0.28 : 0.06,
          elevation: theme.dark ? 4 : 2,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View style={[styles.stripe, { backgroundColor: accentColor }]} />
      <View style={[styles.iconWrap, { backgroundColor: accentGlow }]}>
        <Text style={styles.iconText}>{icon}</Text>
      </View>
      <Text style={[styles.title, { color: theme.colors.textPrimary }]}>{title}</Text>
      <Text style={[styles.description, { color: theme.colors.textSecondary }]}>{description}</Text>
      <View style={[styles.footer, { borderTopColor: theme.colors.borderSubtle }]}>
        <View style={styles.statusRow}>
          <View style={[styles.dot, { backgroundColor: theme.colors.green }]} />
          <Text style={[styles.statusText, { color: theme.colors.textMuted }]}>ACTIVE</Text>
        </View>
        <Text style={[styles.arrow, { color: theme.colors.textMuted }]}>›</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    paddingTop: 20,
    marginBottom: 10,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
  },
  stripe: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  iconText: { fontSize: 20 },
  title: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
    marginBottom: 5,
  },
  description: {
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 14,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    paddingTop: 10,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.8,
  },
  arrow: { fontSize: 20 },
});
