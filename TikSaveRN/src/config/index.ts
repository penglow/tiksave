/**
 * App configuration, API endpoints, and the Obsidian Luxe design system.
 * Single source of truth for runtime config, theme tokens, and layout constants.
 */

import { Platform, StyleSheet } from 'react-native';
import Constants from 'expo-constants';

// ---------------------------------------------------------------------------
// API configuration
// ---------------------------------------------------------------------------

const getLocalIp = (): string => {
  const envApiHost = Constants.expoConfig?.extra?.apiHost;
  if (envApiHost) return envApiHost;
  const debuggerHost = Constants.expoConfig?.hostUri?.split(':')[0];
  if (debuggerHost && Platform.OS !== 'web') return debuggerHost;
  return 'localhost';
};

const getConfiguredApiUrl = (): string | null => {
  const envApiUrl = process.env.EXPO_PUBLIC_API_URL || Constants.expoConfig?.extra?.apiBaseURL;
  if (typeof envApiUrl !== 'string') return null;

  const trimmed = envApiUrl.trim();
  return trimmed ? trimmed.replace(/\/+$/, '') : null;
};

const getApiUrl = () => {
  const configuredApiUrl = getConfiguredApiUrl();
  if (configuredApiUrl) return configuredApiUrl;
  if (!__DEV__) return 'https://your-production-api.com/api';
  if (Platform.OS === 'web') return 'http://localhost:3000/api';
  const localIp = getLocalIp();
  return `http://${localIp}:3000/api`;
};

const getGoogleMapsApiKey = (): string => {
  const envKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || Constants.expoConfig?.extra?.googleMapsApiKey;
  return typeof envKey === 'string' ? envKey.trim() : '';
};

/** Runtime app and API settings resolved from env and Expo config. */
export const Config = {
  apiBaseURL: getApiUrl(),
  googleMapsApiKey: getGoogleMapsApiKey(),
  enableSemanticSearch: true,
  enableVideoUpload: true,
  autoFileHighConfidence: true,
  highConfidenceThreshold: 0.85,
  mediumConfidenceThreshold: 0.60,
  thumbnailCacheSize: 100 * 1024 * 1024,
  maxCachedThumbnails: 500,
  apiTimeoutMs: 60000,
  uploadTimeoutMs: 300000,
};

// =============================================================================
// DESIGN SYSTEM v3 — "Obsidian Luxe"
// =============================================================================
// A refined, premium aesthetic evolution with:
// - Deeper obsidian backgrounds with subtle warmth
// - Warm coral-salmon accent with gold undertones
// - Glassmorphism-ready surfaces with controlled opacity
// - Editorial typography with tighter tracking
// - Cinematic shadows with warm color casts
// - Smooth organic motion curves
// =============================================================================

const DarkColors = {
  // Backgrounds — deep obsidian with warmth
  background: '#0c0c0e',
  surface: '#141416',
  surfaceHover: '#1c1c1f',
  surfaceElevated: '#222226',
  glass: 'rgba(20, 20, 22, 0.72)',
  glassBorder: 'rgba(245, 245, 240, 0.06)',

  // Text — warm off-white hierarchy
  text: '#f5f5f0',
  textSecondary: 'rgba(245, 245, 240, 0.70)',
  textTertiary: 'rgba(245, 245, 240, 0.45)',
  textQuaternary: 'rgba(245, 245, 240, 0.25)',

  // Accent — warm coral-salmon with gold undertone
  accent: '#e8705a',
  accentLight: '#f28b78',
  accentDark: '#c45a46',
  accentSubtle: 'rgba(232, 112, 90, 0.12)',
  accentMuted: 'rgba(232, 112, 90, 0.05)',

  // Primary — warm white for dark mode
  primary: '#f5f5f0',
  secondary: 'rgba(245, 245, 240, 0.70)',

  // Borders — warm subtle
  border: 'rgba(245, 245, 240, 0.07)',
  borderStrong: 'rgba(245, 245, 240, 0.14)',
  divider: 'rgba(245, 245, 240, 0.05)',

  // Status — refined jewel tones
  success: '#4ade80',
  successSubtle: 'rgba(74, 222, 128, 0.10)',
  warning: '#fbbf24',
  warningSubtle: 'rgba(251, 191, 36, 0.10)',
  error: '#f87171',
  errorSubtle: 'rgba(248, 113, 113, 0.10)',

  // Legacy mappings
  backgroundSecondary: '#141416',
  backgroundTertiary: '#1c1c1f',
  overlay: 'rgba(12, 12, 14, 0.88)',
  overlayLight: 'rgba(245, 245, 240, 0.04)',
  overlayDark: 'rgba(0, 0, 0, 0.92)',
};

const LightColors = {
  // Backgrounds — warm off-white
  background: '#f7f6f3',
  surface: '#ffffff',
  surfaceHover: '#f0eeea',
  surfaceElevated: '#ffffff',
  glass: 'rgba(255, 255, 255, 0.80)',
  glassBorder: 'rgba(26, 26, 30, 0.06)',

  // Text — deep ink
  text: '#1a1a1e',
  textSecondary: 'rgba(26, 26, 30, 0.65)',
  textTertiary: 'rgba(26, 26, 30, 0.42)',
  textQuaternary: 'rgba(26, 26, 30, 0.25)',

  // Accent — coral-salmon
  accent: '#d45a44',
  accentLight: '#e8705a',
  accentDark: '#b34834',
  accentSubtle: 'rgba(212, 90, 68, 0.08)',
  accentMuted: 'rgba(212, 90, 68, 0.04)',

  // Primary
  primary: '#1a1a1e',
  secondary: 'rgba(26, 26, 30, 0.65)',

  // Borders
  border: 'rgba(26, 26, 30, 0.07)',
  borderStrong: 'rgba(26, 26, 30, 0.13)',
  divider: 'rgba(26, 26, 30, 0.05)',

  // Status
  success: '#16a34a',
  successSubtle: 'rgba(22, 163, 74, 0.08)',
  warning: '#d97706',
  warningSubtle: 'rgba(217, 119, 6, 0.08)',
  error: '#dc2626',
  errorSubtle: 'rgba(220, 38, 38, 0.08)',

  // Legacy mappings
  backgroundSecondary: '#ffffff',
  backgroundTertiary: '#f0eeea',
  overlay: 'rgba(26, 26, 30, 0.03)',
  overlayLight: 'rgba(26, 26, 30, 0.04)',
  overlayDark: 'rgba(0, 0, 0, 0.72)',
};

export const Colors = DarkColors;

/** Resolve light or dark palette based on effective theme. */
export const getThemeColors = (isDark: boolean) => {
  return isDark ? DarkColors : LightColors;
};

// Gradient presets
export const Gradients = {
  heroDark: ['#141416', '#0c0c0e'] as const,
  heroLight: ['#ffffff', '#f7f6f3'] as const,
  accentDark: ['#e8705a', '#c45a46'] as const,
  accentLight: ['#f28b78', '#d45a44'] as const,
  surfaceDark: ['#222226', '#141416'] as const,
  surfaceLight: ['#ffffff', '#f0eeea'] as const,
  goldDark: ['#fbbf24', '#e8705a'] as const,
  goldLight: ['#fbbf24', '#d45a44'] as const,
};

// Category Colors — contextual, sophisticated jewel tones
export const CategoryColors = {
  food: '#f97316',
  travel: '#06b6d4',
  fitness: '#22c55e',
  fashion: '#ec4899',
  beauty: '#f472b6',
  tech: '#8b5cf6',
  finance: '#10b981',
  comedy: '#fbbf24',
  music: '#ef4444',
  dance: '#a855f7',
  pets: '#f59e0b',
  diy: '#6366f1',
  education: '#14b8a6',
  gaming: '#7c3aed',
  sports: '#059669',
  art: '#db2777',
  nature: '#16a34a',
  lifestyle: '#d946ef',
  news: '#64748b',
  shopping: '#f43f5e',
  default: '#6b7280',
};

// ---------------------------------------------------------------------------
// TYPOGRAPHY — Editorial refined scale
// ---------------------------------------------------------------------------
// Display: Fraunces — a variable-axis editorial serif with soft optical sizing.
//          Falls back to Georgia/serif on platforms where Fraunces isn't loaded.
// Body:    DM Sans — clean geometric humanist sans, friendly + characterful.
//          Falls back to the platform UI sans-serif.
// ---------------------------------------------------------------------------

const displayFontFamily = Platform.select({
  web: '"Fraunces", "Times New Roman", Georgia, serif',
  ios: 'Georgia',
  android: 'serif',
  default: 'serif',
});

const bodyFontFamily = Platform.select({
  web: '"DM Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  ios: 'System',
  android: 'sans-serif',
  default: 'sans-serif',
});

const monoFontFamily = Platform.select({
  web: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
  ios: 'Menlo',
  android: 'monospace',
  default: 'monospace',
});

export const FontFamily = {
  display: displayFontFamily,
  body: bodyFontFamily,
  mono: monoFontFamily,
};

export const Typography = {
  // Display — editorial serif with tight tracking, italic optical settings on web
  displayLg: {
    fontFamily: displayFontFamily,
    fontSize: 44,
    fontWeight: '700' as const,
    letterSpacing: -1.6,
    lineHeight: 48,
  },
  displayMd: {
    fontFamily: displayFontFamily,
    fontSize: 32,
    fontWeight: '700' as const,
    letterSpacing: -1.1,
    lineHeight: 36,
  },
  displaySm: {
    fontFamily: displayFontFamily,
    fontSize: 24,
    fontWeight: '700' as const,
    letterSpacing: -0.6,
    lineHeight: 30,
  },

  // Headings — sans for UI labels and section headers
  heading: {
    fontFamily: bodyFontFamily,
    fontSize: 20,
    fontWeight: '700' as const,
    letterSpacing: -0.5,
    lineHeight: 26,
  },
  headingSm: {
    fontFamily: bodyFontFamily,
    fontSize: 17,
    fontWeight: '600' as const,
    letterSpacing: -0.3,
    lineHeight: 22,
  },

  // Body
  body: {
    fontFamily: bodyFontFamily,
    fontSize: 16,
    fontWeight: '400' as const,
    letterSpacing: -0.2,
    lineHeight: 24,
  },
  bodyStrong: {
    fontFamily: bodyFontFamily,
    fontSize: 16,
    fontWeight: '600' as const,
    letterSpacing: -0.2,
    lineHeight: 24,
  },
  bodySm: {
    fontFamily: bodyFontFamily,
    fontSize: 14,
    fontWeight: '400' as const,
    letterSpacing: -0.1,
    lineHeight: 20,
  },

  // Labels — micro caps with extra tracking, the editorial supporting cast
  label: {
    fontFamily: bodyFontFamily,
    fontSize: 11,
    fontWeight: '700' as const,
    letterSpacing: 1.2,
    lineHeight: 13,
    textTransform: 'uppercase' as const,
  },
  labelSm: {
    fontFamily: bodyFontFamily,
    fontSize: 10,
    fontWeight: '700' as const,
    letterSpacing: 0.8,
    lineHeight: 12,
    textTransform: 'uppercase' as const,
  },

  // Captions
  caption: {
    fontFamily: bodyFontFamily,
    fontSize: 13,
    fontWeight: '400' as const,
    letterSpacing: -0.3,
    lineHeight: 18,
  },
  captionStrong: {
    fontFamily: bodyFontFamily,
    fontSize: 13,
    fontWeight: '500' as const,
    letterSpacing: 0,
    lineHeight: 18,
  },

  // Quote — italic display for editorial accents
  quote: {
    fontFamily: displayFontFamily,
    fontSize: 18,
    fontStyle: 'italic' as const,
    fontWeight: '400' as const,
    letterSpacing: 0,
    lineHeight: 28,
  },
};

// ---------------------------------------------------------------------------
// SPACING — 8pt grid with refined scale
// ---------------------------------------------------------------------------

export const Spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
  screen: 20,
};

// ---------------------------------------------------------------------------
// BORDER RADIUS — Generous, architectural
// ---------------------------------------------------------------------------

export const BorderRadius = {
  none: 0,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  full: 9999,
};

// ---------------------------------------------------------------------------
// ANIMATION — Snappy, mechanical, cinematic
// ---------------------------------------------------------------------------
// Durations trimmed for a tighter, more reactive feel. Springs lean into
// higher stiffness with proportional damping so motion arrives crisply
// without ringing. Standard easing curve: emphasized-decelerate (Material 3)
// — fast onset, gentle settle.
// ---------------------------------------------------------------------------

export const Animation = {
  duration: {
    instant: 40,
    fast: 90,
    normal: 160,
    slow: 260,
    entrance: 300,
    exit: 180,
  },
  spring: {
    /** Crisp UI gestures — taps, toggles, focus rings. */
    snappy: { damping: 24, stiffness: 620, mass: 0.9 },
    /** Default for entrance reveals — quick onset, controlled settle. */
    gentle: { damping: 22, stiffness: 380, mass: 1 },
    /** Playful overshoot — stamp logos, success states. */
    bouncy: { damping: 12, stiffness: 520, mass: 0.9 },
    /** Slow drift — splash motion, background blob movement. */
    soft: { damping: 32, stiffness: 220, mass: 1.1 },
    /** Editorial luxe — used for hero reveals where weight matters. */
    luxe: { damping: 26, stiffness: 360, mass: 1.05 },
    /** Ultra-snap — the FAB, switches, tab pill morph. */
    crisp: { damping: 28, stiffness: 800, mass: 0.7 },
  },
  /** Per-item delay for staggered list entrances. */
  stagger: 32,
  /** Per-word delay for headline reveals. */
  staggerWord: 50,
  /** Per-character delay for kinetic type. */
  staggerChar: 22,
  press: {
    scale: 0.965,
    opacity: 0.88,
    /** Press-fill sweep across primary CTAs (e.g. MorphButton). */
    fillDuration: 180,
    fillEasing: [0.2, 0.8, 0.4, 1] as [number, number, number, number],
  },
  /** Morph-button transitions: text → spinner → ring → check. */
  morph: {
    textFadeDuration: 120,
    morphDuration: 180,
    ringFillSpring: { damping: 18, stiffness: 220, mass: 0.9 },
    doneScaleSpring: { damping: 14, stiffness: 280, mass: 0.6 },
  },
  /** Horizontal shake used to indicate "you tapped a no-op CTA". */
  shake: {
    amplitude: 6,
    duration: 320,
  },
  /** Standard cubic-bezier curves — kept short and intentional. */
  ease: {
    /** Emphasized decelerate — ideal for entrances. */
    out: [0.16, 1, 0.3, 1] as [number, number, number, number],
    /** Standard symmetric — generic transitions. */
    inOut: [0.45, 0, 0.55, 1] as [number, number, number, number],
    /** Sharp accelerate — exits. */
    in: [0.7, 0, 0.84, 0] as [number, number, number, number],
  },
};

// ---------------------------------------------------------------------------
// SHADOWS — Cinematic with warm color casts
// ---------------------------------------------------------------------------

export const Shadows = {
  xs: Platform.select({
    ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2 },
    android: { elevation: 1 },
    default: { boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)' },
  }),
  sm: Platform.select({
    ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6 },
    android: { elevation: 2 },
    default: { boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)' },
  }),
  md: Platform.select({
    ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.10, shadowRadius: 16 },
    android: { elevation: 5 },
    default: { boxShadow: '0 6px 20px rgba(0, 0, 0, 0.10)' },
  }),
  lg: Platform.select({
    ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.14, shadowRadius: 32 },
    android: { elevation: 10 },
    default: { boxShadow: '0 12px 32px rgba(0, 0, 0, 0.14)' },
  }),
  glow: Platform.select({
    ios: { shadowColor: '#e8705a', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.30, shadowRadius: 20 },
    android: { elevation: 8 },
    default: { boxShadow: '0 0 24px rgba(232, 112, 90, 0.30)' },
  }),
  warm: Platform.select({
    ios: { shadowColor: '#e8705a', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 16 },
    android: { elevation: 4 },
    default: { boxShadow: '0 4px 16px rgba(232, 112, 90, 0.08)' },
  }),
};

// ---------------------------------------------------------------------------
// HAIRLINE
// ---------------------------------------------------------------------------

export const Hairline = StyleSheet.hairlineWidth || 1;

// Extra bottom padding for screens with floating tab bar
export const TAB_BAR_OVERLAP = 100;
