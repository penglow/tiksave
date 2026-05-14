import { Platform, StyleSheet } from 'react-native';
import Constants from 'expo-constants';

// API Configuration
const getLocalIp = (): string => {
  const envApiHost = Constants.expoConfig?.extra?.apiHost;
  if (envApiHost) return envApiHost;
  const debuggerHost = Constants.expoConfig?.hostUri?.split(':')[0];
  if (debuggerHost && Platform.OS !== 'web') return debuggerHost;
  return 'localhost';
};

const getApiUrl = () => {
  if (!__DEV__) return 'https://your-production-api.com/api';
  if (Platform.OS === 'web') return 'http://localhost:3000/api';
  const localIp = getLocalIp();
  return `http://${localIp}:3000/api`;
};

export const Config = {
  apiBaseURL: getApiUrl(),
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

export const Typography = {
  // Display
  displayLg: {
    fontSize: 40,
    fontWeight: '800' as const,
    letterSpacing: -1.4,
    lineHeight: 44,
  },
  displayMd: {
    fontSize: 30,
    fontWeight: '700' as const,
    letterSpacing: -1.0,
    lineHeight: 34,
  },
  displaySm: {
    fontSize: 24,
    fontWeight: '700' as const,
    letterSpacing: -0.6,
    lineHeight: 30,
  },

  // Headings
  heading: {
    fontSize: 20,
    fontWeight: '700' as const,
    letterSpacing: -0.5,
    lineHeight: 26,
  },
  headingSm: {
    fontSize: 17,
    fontWeight: '600' as const,
    letterSpacing: -0.3,
    lineHeight: 22,
  },

  // Body
  body: {
    fontSize: 16,
    fontWeight: '400' as const,
    letterSpacing: -0.2,
    lineHeight: 24,
  },
  bodyStrong: {
    fontSize: 16,
    fontWeight: '600' as const,
    letterSpacing: -0.2,
    lineHeight: 24,
  },
  bodySm: {
    fontSize: 14,
    fontWeight: '400' as const,
    letterSpacing: -0.1,
    lineHeight: 20,
  },

  // Labels
  label: {
    fontSize: 11,
    fontWeight: '700' as const,
    letterSpacing: 0.8,
    lineHeight: 13,
    textTransform: 'uppercase' as const,
  },
  labelSm: {
    fontSize: 10,
    fontWeight: '700' as const,
    letterSpacing: 0.5,
    lineHeight: 12,
    textTransform: 'uppercase' as const,
  },

  // Captions
  caption: {
    fontSize: 13,
    fontWeight: '400' as const,
    letterSpacing: 0,
    lineHeight: 18,
  },
  captionStrong: {
    fontSize: 13,
    fontWeight: '500' as const,
    letterSpacing: 0,
    lineHeight: 18,
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
// ANIMATION — Smooth, cinematic
// ---------------------------------------------------------------------------

export const Animation = {
  duration: {
    instant: 50,
    fast: 120,
    normal: 200,
    slow: 350,
    entrance: 400,
    exit: 250,
  },
  spring: {
    snappy: { damping: 22, stiffness: 500, mass: 1 },
    gentle: { damping: 28, stiffness: 350, mass: 1 },
    bouncy: { damping: 14, stiffness: 400, mass: 1 },
    soft: { damping: 30, stiffness: 200, mass: 1 },
    luxe: { damping: 24, stiffness: 280, mass: 1.2 },
  },
  stagger: 60,
  press: {
    scale: 0.96,
    opacity: 0.85,
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
