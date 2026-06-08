/**
 * Frosted-glass panel using expo-blur on iOS/web and a solid glass tint on Android.
 * Wraps children with themed border, padding, and corner radius.
 */

import React from 'react';
import { View, StyleSheet, ViewStyle, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { BorderRadius, Spacing } from '../config';
import { useTheme } from '../hooks/useTheme';

// --- Types / props ---
interface GlassSurfaceProps {
  children: React.ReactNode;
  intensity?: number;
  tint?: 'light' | 'dark' | 'default';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  borderRadius?: keyof typeof BorderRadius;
  style?: ViewStyle;
  border?: boolean;
}

// --- Main component ---
export function GlassSurface({
  children,
  intensity = 40,
  tint = 'default',
  padding = 'md',
  borderRadius = 'lg',
  style,
  border = true,
}: GlassSurfaceProps) {
  const { colors, isDark } = useTheme();

  const paddingMap = {
    none: 0,
    sm: Spacing.sm,
    md: Spacing.md,
    lg: Spacing.lg,
  };

  const radiusMap = {
    none: BorderRadius.none,
    xs: BorderRadius.xs,
    sm: BorderRadius.sm,
    md: BorderRadius.md,
    lg: BorderRadius.lg,
    xl: BorderRadius.xl,
    full: BorderRadius.full,
  };

  const resolvedTint = tint === 'default' ? (isDark ? 'dark' : 'light') : tint;

  return (
    <View
      style={[
        styles.container,
        {
          borderRadius: radiusMap[borderRadius],
          // Android has no reliable BlurView — fall back to semi-opaque fill
          backgroundColor: Platform.OS === 'android' ? colors.glass : undefined,
          borderWidth: border ? 1 : 0,
          borderColor: colors.glassBorder,
          padding: paddingMap[padding],
          overflow: 'hidden',
        },
        style,
      ]}
    >
      {Platform.OS !== 'android' && (
        <BlurView
          intensity={intensity}
          tint={resolvedTint}
          style={[StyleSheet.absoluteFill, { borderRadius: radiusMap[borderRadius] }]}
        />
      )}
      <View style={styles.content}>{children}</View>
    </View>
  );
}

// --- Styles ---
const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  content: {
    position: 'relative',
    zIndex: 1,
  },
});
