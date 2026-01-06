// API Configuration
export const Config = {
  // API Base URL - switch for development/production
  apiBaseURL: __DEV__ ? 'http://localhost:3000/api' : 'https://your-production-api.com/api',

  // Feature Flags
  enableSemanticSearch: true,
  enableVideoUpload: true,
  autoFileHighConfidence: true,

  // Confidence Thresholds
  highConfidenceThreshold: 0.85,
  mediumConfidenceThreshold: 0.60,

  // Cache Settings
  thumbnailCacheSize: 100 * 1024 * 1024, // 100MB
  maxCachedThumbnails: 500,

  // Timeouts
  apiTimeoutMs: 30000,
  uploadTimeoutMs: 300000,
};

// Theme Colors
export const Colors = {
  // Background colors
  background: '#12121F',
  backgroundSecondary: '#1A1A2E',
  backgroundTertiary: 'rgba(255, 255, 255, 0.05)',

  // Primary colors
  primary: '#06B6D4', // cyan
  secondary: '#A855F7', // purple

  // Text colors
  text: '#FFFFFF',
  textSecondary: 'rgba(255, 255, 255, 0.7)',
  textTertiary: 'rgba(255, 255, 255, 0.5)',
  textQuaternary: 'rgba(255, 255, 255, 0.3)',

  // Status colors
  success: '#22C55E',
  warning: '#F97316',
  error: '#EF4444',

  // Overlay colors
  overlay: 'rgba(255, 255, 255, 0.1)',
  overlayLight: 'rgba(255, 255, 255, 0.05)',
  overlayDark: 'rgba(0, 0, 0, 0.7)',

  // Border colors
  border: 'rgba(255, 255, 255, 0.1)',
};

// Font families - using system fonts, but can be customized
export const Fonts = {
  regular: 'System',
  medium: 'System',
  semibold: 'System',
  bold: 'System',
  black: 'System',
};

// Spacing scale
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

// Border radius scale
export const BorderRadius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 16,
  full: 9999,
};

