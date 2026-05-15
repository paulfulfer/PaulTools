import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';

/**
 * Ambient background orbs matching the web version's radial-gradient blobs.
 * Since expo-blur is not installed, each orb is three stacked circles of
 * increasing opacity — outermost faint, innermost slightly stronger —
 * approximating the web's filter:blur(80px) softness.
 *
 * Layout: blue top-right · purple bottom-left · green center.
 */
export default function BackgroundOrbs() {
  const { theme, isDark } = useTheme();
  const c = theme.colors;

  // Opacity levels tuned so the orbs are visible but never overpower content.
  const o1 = isDark ? 0.06 : 0.09;   // outermost ring
  const o2 = isDark ? 0.09 : 0.13;   // middle ring
  const o3 = isDark ? 0.12 : 0.17;   // core

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">

      {/* ── Blue orb — top right ─────────────────────────── */}
      <View style={[s.orb500, s.topRight,  { backgroundColor: c.blue,   opacity: o1 }]} />
      <View style={[s.orb300, s.topRightM, { backgroundColor: c.blue,   opacity: o2 }]} />
      <View style={[s.orb150, s.topRightS, { backgroundColor: c.blue,   opacity: o3 }]} />

      {/* ── Purple orb — bottom left ─────────────────────── */}
      <View style={[s.orb500, s.botLeft,   { backgroundColor: c.purple, opacity: o1 }]} />
      <View style={[s.orb300, s.botLeftM,  { backgroundColor: c.purple, opacity: o2 }]} />
      <View style={[s.orb150, s.botLeftS,  { backgroundColor: c.purple, opacity: o3 }]} />

      {/* ── Green orb — center ───────────────────────────── */}
      <View style={[s.orb400, s.center,    { backgroundColor: c.green,  opacity: o1 }]} />
      <View style={[s.orb220, s.centerM,   { backgroundColor: c.green,  opacity: o2 }]} />

    </View>
  );
}

const s = StyleSheet.create({
  orb500: { position: 'absolute', width: 500, height: 500, borderRadius: 250 },
  orb400: { position: 'absolute', width: 400, height: 400, borderRadius: 200 },
  orb300: { position: 'absolute', width: 300, height: 300, borderRadius: 150 },
  orb220: { position: 'absolute', width: 220, height: 220, borderRadius: 110 },
  orb150: { position: 'absolute', width: 150, height: 150, borderRadius: 75  },

  // Blue — top right
  topRight:  { top: -180, right: -180 },
  topRightM: { top: -100, right: -100 },
  topRightS: { top:  -50, right:  -50 },

  // Purple — bottom left
  botLeft:   { bottom: -180, left: -180 },
  botLeftM:  { bottom: -100, left: -100 },
  botLeftS:  { bottom:  -50, left:  -50 },

  // Green — center
  center:    { top: '30%', left: '15%' },
  centerM:   { top: '38%', left: '25%' },
});
