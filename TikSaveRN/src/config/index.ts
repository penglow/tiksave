import { Platform, StyleSheet } from 'react-native';

// API Configuration
const LOCAL_IP = '192.168.100.150';

const getApiUrl = () => {
  if (!__DEV__) return 'https://your-production-api.com/api';
  if (Platform.OS === 'web') return 'http://localhost:3000/api';
  return `http://${LOCAL_IP}:3000/api`;
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
  apiTimeoutMs: 30000,
  uploadTimeoutMs: 300000,
};

// =============================================================================
// 2025 DESIGN SYSTEM - "Sharp Clarity"
// =============================================================================

// -----------------------------------------------------------------------------
// COLOR SYSTEM - Monochromatic with contextual accents
// -----------------------------------------------------------------------------

const DarkColors = {
  // Backgrounds - Deep, minimal
  background: '#0a0a0a',
  surface: '#141414',
  surfaceHover: '#1a1a1a',

  // Text - Opacity-based hierarchy
  text: '#ffffff',
  textSecondary: 'rgba(255, 255, 255, 0.65)',
  textTertiary: 'rgba(255, 255, 255, 0.4)',
  textQuaternary: 'rgba(255, 255, 255, 0.25)',

  // Accent - White-based for dark mode (color comes from context)
  accent: '#ffffff',
  accentSubtle: 'rgba(255, 255, 255, 0.08)',
  accentMuted: 'rgba(255, 255, 255, 0.04)',

  // Borders - Ultra subtle
  border: 'rgba(255, 255, 255, 0.08)',
  borderStrong: 'rgba(255, 255, 255, 0.15)',

  // Status colors - Muted, not screaming
  success: '#22c55e',
  successSubtle: 'rgba(34, 197, 94, 0.15)',
  warning: '#f59e0b',
  warningSubtle: 'rgba(245, 158, 11, 0.15)',
  error: '#ef4444',
  errorSubtle: 'rgba(239, 68, 68, 0.15)',

  // Legacy mappings for compatibility
  primary: '#ffffff',
  secondary: 'rgba(255, 255, 255, 0.65)',
  backgroundSecondary: '#141414',
  backgroundTertiary: '#1a1a1a',
  overlay: 'rgba(255, 255, 255, 0.04)',
  overlayLight: 'rgba(255, 255, 255, 0.06)',
  overlayDark: 'rgba(0, 0, 0, 0.85)',
};

const LightColors = {
  // Backgrounds
  background: '#fafafa',
  surface: '#ffffff',
  surfaceHover: '#f5f5f5',

  // Text
  text: '#0a0a0a',
  textSecondary: 'rgba(10, 10, 10, 0.65)',
  textTertiary: 'rgba(10, 10, 10, 0.4)',
  textQuaternary: 'rgba(10, 10, 10, 0.25)',

  // Accent
  accent: '#0a0a0a',
  accentSubtle: 'rgba(10, 10, 10, 0.06)',
  accentMuted: 'rgba(10, 10, 10, 0.03)',

  // Borders
  border: 'rgba(10, 10, 10, 0.08)',
  borderStrong: 'rgba(10, 10, 10, 0.15)',

  // Status colors
  success: '#16a34a',
  successSubtle: 'rgba(22, 163, 74, 0.1)',
  warning: '#d97706',
  warningSubtle: 'rgba(217, 119, 6, 0.1)',
  error: '#dc2626',
  errorSubtle: 'rgba(220, 38, 38, 0.1)',

  // Legacy mappings
  primary: '#0a0a0a',
  secondary: 'rgba(10, 10, 10, 0.65)',
  backgroundSecondary: '#ffffff',
  backgroundTertiary: '#f5f5f5',
  overlay: 'rgba(10, 10, 10, 0.03)',
  overlayLight: 'rgba(10, 10, 10, 0.04)',
  overlayDark: 'rgba(0, 0, 0, 0.75)',
};

export const Colors = DarkColors;

export const getThemeColors = (isDark: boolean) => {
  return isDark ? DarkColors : LightColors;
};

// Category Colors - Contextual accents (used sparingly)
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

// -----------------------------------------------------------------------------
// TYPOGRAPHY SYSTEM - Sharp, editorial
// -----------------------------------------------------------------------------

export const Typography = {
  // Display - For heroes and major headings
  displayLg: {
    fontSize: 32,
    fontWeight: '700' as const,
    letterSpacing: -1.2,
    lineHeight: 36,
  },
  displayMd: {
    fontSize: 24,
    fontWeight: '600' as const,
    letterSpacing: -0.8,
    lineHeight: 28,
  },

  // Headings
  heading: {
    fontSize: 18,
    fontWeight: '600' as const,
    letterSpacing: -0.4,
    lineHeight: 24,
  },
  headingSm: {
    fontSize: 16,
    fontWeight: '600' as const,
    letterSpacing: -0.3,
    lineHeight: 20,
  },

  // Body text
  body: {
    fontSize: 15,
    fontWeight: '400' as const,
    letterSpacing: -0.2,
    lineHeight: 22,
  },
  bodyStrong: {
    fontSize: 15,
    fontWeight: '600' as const,
    letterSpacing: -0.2,
    lineHeight: 22,
  },
  bodySm: {
    fontSize: 14,
    fontWeight: '400' as const,
    letterSpacing: -0.1,
    lineHeight: 20,
  },

  // Labels - ALL CAPS style
  label: {
    fontSize: 11,
    fontWeight: '600' as const,
    letterSpacing: 0.8,
    lineHeight: 14,
    textTransform: 'uppercase' as const,
  },
  labelSm: {
    fontSize: 10,
    fontWeight: '600' as const,
    letterSpacing: 0.6,
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

// Font families - Using Inter-style system fonts
export const Fonts = {
  regular: Platform.select({
    ios: 'System',
    android: 'Roboto',
    default: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  }),
  medium: Platform.select({
    ios: 'System',
    android: 'Roboto-Medium',
    default: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  }),
  semibold: Platform.select({
    ios: 'System',
    android: 'Roboto-Medium',
    default: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  }),
  bold: Platform.select({
    ios: 'System',
    android: 'Roboto-Bold',
    default: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  }),
};

// -----------------------------------------------------------------------------
// SPACING SYSTEM - Strict 8pt grid
// -----------------------------------------------------------------------------

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
};

// -----------------------------------------------------------------------------
// BORDER RADIUS - Sharp with strategic softness
// -----------------------------------------------------------------------------

export const BorderRadius = {
  none: 0,
  xs: 2,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
};

// -----------------------------------------------------------------------------
// ANIMATION TIMING - Framer Motion-inspired
// -----------------------------------------------------------------------------

export const Animation = {
  // Durations
  duration: {
    instant: 100,
    fast: 150,
    normal: 200,
    slow: 300,
    entrance: 350,
    exit: 250,
  },

  // Spring configs for react-native-reanimated
  spring: {
    snappy: { damping: 20, stiffness: 300, mass: 1 },
    gentle: { damping: 25, stiffness: 200, mass: 1 },
    bouncy: { damping: 15, stiffness: 200, mass: 1 },
  },

  // Stagger delay for lists
  stagger: 40,

  // Press animation values
  press: {
    scale: 0.97,
    opacity: 0.8,
  },
};

// -----------------------------------------------------------------------------
// SHADOWS - Minimal, modern
// -----------------------------------------------------------------------------

export const Shadows = {
  sm: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
    },
    android: { elevation: 1 },
    default: { boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)' },
  }),
  md: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 4,
    },
    android: { elevation: 2 },
    default: { boxShadow: '0 2px 4px rgba(0, 0, 0, 0.08)' },
  }),
  lg: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.12,
      shadowRadius: 8,
    },
    android: { elevation: 4 },
    default: { boxShadow: '0 4px 8px rgba(0, 0, 0, 0.12)' },
  }),
};

// -----------------------------------------------------------------------------
// HAIRLINE - Cross-platform thin border
// -----------------------------------------------------------------------------

export const Hairline = StyleSheet.hairlineWidth || 1;
