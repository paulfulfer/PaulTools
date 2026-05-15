import { Platform } from 'react-native';

// ─── Monospace font ───────────────────────────────────────────────────────────
// Exported so screens can import centrally: import { MONO } from '../../theme'
export const MONO = Platform.select({ ios: 'Courier New', android: 'monospace' });

// ─── Design tokens ────────────────────────────────────────────────────────────

const colors = {
  // ── Primary tokens (new design system) ───────────────────────────────────
  bg:        '#0a0c0a',                    // app background
  surface:   '#13160f',                    // cards / panels
  elevated:  '#1a1f16',                    // elevated surfaces, headers
  accentBg:  '#1a2a1a',                    // tinted accent background
  input:     '#0f120d',                    // form inputs
  accent:    '#6bba70',                    // primary green accent
  accentLt:  '#a8d878',                    // lighter accent / secondary highlight
  text:      '#f0f1ec',                    // primary text
  text2:     'rgba(255,255,255,0.55)',     // secondary text
  text3:     'rgba(255,255,255,0.25)',     // muted / placeholder text
  border:    'rgba(255,255,255,0.08)',     // subtle border
  borderAc:  'rgba(107,186,112,0.25)',     // accent-tinted border

  // ── Legacy aliases (backward compat — all existing screens use these) ─────
  bgBase:        '#0a0c0a',                  // → bg
  bgCard:        '#13160f',                  // → surface
  bgGlass:       '#1a1f16',                  // → elevated
  borderSubtle:  'rgba(255,255,255,0.08)',   // → border
  borderGlass:   'rgba(255,255,255,0.08)',   // → border
  textPrimary:   '#f0f1ec',                  // → text
  textSecondary: 'rgba(255,255,255,0.55)',   // → text2
  textMuted:     'rgba(255,255,255,0.25)',   // → text3

  // Semantic colors reinterpreted in new green-forward palette
  green:      '#6bba70',                    // → accent
  greenGlow:  '#1a2a1a',                    // → accentBg
  blue:       '#6bba70',                    // → accent (no distinct blue in new system)
  blueGlow:   '#1a2a1a',                    // → accentBg
  amber:      '#a8d878',                    // → accentLt (secondary / warm highlight)
  amberGlow:  'rgba(168,216,120,0.12)',
  purple:     '#8fba9a',                    // sage-green (harmonious purple stand-in)
  purpleGlow: 'rgba(143,186,154,0.12)',
  red:        '#e05c5c',                    // kept for destructive / error UI
  redGlow:    'rgba(224,92,92,0.12)',
  teal:       '#a8d878',                    // → accentLt
  tealGlow:   'rgba(168,216,120,0.10)',

  // Navigation / tab bar
  tabBar:       '#0a0c0a',                  // → bg
  tabBarBorder: 'rgba(255,255,255,0.08)',   // → border
  tabInactive:  'rgba(255,255,255,0.25)',   // → text3
};

const radii = {
  sm:      6,
  md:      10,
  card:    14,
  section: 20,
};

const typography = {
  mono: MONO,
};

// ─── Single theme (dark-first design) ─────────────────────────────────────────
export const theme = {
  dark:       true,
  colors,
  radii,
  typography,
};

// Legacy named exports — ThemeContext still imports these; both resolve to the
// same design so toggling theme changes nothing visually (intentional).
export const lightTheme = theme;
export const darkTheme  = theme;
