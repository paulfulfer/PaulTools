import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  Switch, StyleSheet, Platform, Alert,
} from 'react-native';
import { useTheme }   from '../../context/ThemeContext';
import { useAuth }    from '../../context/AuthContext';
import { useHaptics } from '../../context/HapticsContext';

const MONO = 'Inter_500Medium';
const APP_VERSION = '1.0.0';
const WEB_URL     = 'paulfulfer.github.io/my-tools';

// ─── Shared layout pieces ─────────────────────────────────────────────────────

function SectionLabel({ title, c }) {
  return (
    <Text style={[sl.t, { color: c.textMuted, fontFamily: MONO }]}>
      {title.toUpperCase()}
    </Text>
  );
}
const sl = StyleSheet.create({
  t: { fontSize: 10, fontWeight: '700', letterSpacing: 1, marginTop: 28, marginBottom: 6, marginLeft: 2 },
});

function SettingRow({ label, sublabel, value, right, onPress, danger, c, isFirst, isLast }) {
  const inner = (
    <View style={[
      row.wrap,
      { backgroundColor: c.bgCard, borderColor: c.borderSubtle },
      isFirst && row.first,
      isLast  && row.last,
    ]}>
      <View style={{ flex: 1, marginRight: 12 }}>
        <Text style={[row.label, { color: danger ? c.red : c.textPrimary, fontFamily: MONO }]}>
          {label}
        </Text>
        {!!sublabel && (
          <Text style={[row.sub, { color: c.textMuted, fontFamily: MONO }]}>{sublabel}</Text>
        )}
      </View>
      {right ?? (value ? <Text style={[row.value, { color: c.textMuted, fontFamily: MONO }]}>{value}</Text> : null)}
    </View>
  );

  return onPress ? (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>{inner}</TouchableOpacity>
  ) : inner;
}
const row = StyleSheet.create({
  wrap:  { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 1 },
  first: { borderTopLeftRadius: 10, borderTopRightRadius: 10 },
  last:  { borderBottomLeftRadius: 10, borderBottomRightRadius: 10, borderBottomWidth: 0 },
  label: { fontSize: 14, fontWeight: '500' },
  sub:   { fontSize: 11, marginTop: 2 },
  value: { fontSize: 13 },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const { theme, isDark, toggleTheme } = useTheme();
  const { user, logout }               = useAuth();
  const { hapticsEnabled, triggerHaptic, toggleHaptics } = useHaptics();
  const c = theme.colors;

  const handleToggleTheme = () => {
    triggerHaptic();
    toggleTheme();
  };

  const handleToggleHaptics = () => {
    triggerHaptic();
    toggleHaptics();
  };

  const handleSignOut = () => {
    triggerHaptic();
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: logout },
    ]);
  };

  // Initials avatar for account section
  const displayName = user?.displayName || 'User';
  const email       = user?.email || '';
  const initials    = displayName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join('');

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={s.scroll}
      showsVerticalScrollIndicator={false}
    >

      {/* ── Appearance ──────────────────────────────────────────── */}
      <SectionLabel title="Appearance" c={c} />
      <View style={[s.card, { borderColor: c.borderSubtle }]}>
        <SettingRow
          label="Dark Mode"
          sublabel={isDark ? 'Dark theme active' : 'Light theme active'}
          isFirst isLast
          right={
            <Switch
              value={isDark}
              onValueChange={handleToggleTheme}
              trackColor={{ false: c.borderSubtle, true: c.blue }}
              thumbColor={c.bgCard}
            />
          }
          c={c}
        />
      </View>

      {/* ── Haptics ─────────────────────────────────────────────── */}
      <SectionLabel title="Haptics" c={c} />
      <View style={[s.card, { borderColor: c.borderSubtle }]}>
        <SettingRow
          label="Button Feedback"
          sublabel={hapticsEnabled ? 'Light vibration on taps' : 'Silent'}
          isFirst isLast
          right={
            <Switch
              value={hapticsEnabled}
              onValueChange={handleToggleHaptics}
              trackColor={{ false: c.borderSubtle, true: c.green }}
              thumbColor={c.bgCard}
            />
          }
          c={c}
        />
      </View>

      {/* ── Account ─────────────────────────────────────────────── */}
      <SectionLabel title="Account" c={c} />
      <View style={[s.card, { borderColor: c.borderSubtle }]}>
        {/* User identity row */}
        <View style={[s.accountRow, { borderBottomColor: c.borderSubtle }]}>
          <View style={[s.avatar, { backgroundColor: c.blueGlow, borderColor: c.blue }]}>
            <Text style={[s.avatarTxt, { color: c.blue, fontFamily: MONO }]}>{initials}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.accountName, { color: c.textPrimary, fontFamily: MONO }]}>{displayName}</Text>
            <Text style={[s.accountEmail, { color: c.textMuted, fontFamily: MONO }]}>{email}</Text>
          </View>
        </View>
        {/* Sign out */}
        <SettingRow
          label="Sign Out"
          danger
          isLast
          onPress={handleSignOut}
          right={<Text style={{ color: c.red, fontSize: 16, fontWeight: '500' }}>›</Text>}
          c={c}
        />
      </View>

      {/* ── App Info ────────────────────────────────────────────── */}
      <SectionLabel title="App Info" c={c} />
      <View style={[s.card, { borderColor: c.borderSubtle }]}>
        <SettingRow label="Version" value={APP_VERSION} isFirst c={c} />
        <SettingRow label="Web Version" value={WEB_URL}  isLast  c={c} />
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  scroll:       { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 80 },
  card:         { borderRadius: 10, borderWidth: 1, overflow: 'hidden' },

  accountRow:   { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderBottomWidth: 1 },
  avatar:       { width: 46, height: 46, borderRadius: 23, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarTxt:    { fontSize: 16, fontWeight: '700' },
  accountName:  { fontSize: 15, fontWeight: '600', marginBottom: 2 },
  accountEmail: { fontSize: 12 },
});
