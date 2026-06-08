/**
 * Themed surface container with variant presets (default, elevated, outlined, glass, gradient).
 * Used for grouping content on library, settings, and detail screens.
 */

import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { BorderRadius, Shadows, Spacing } from '../config';
import { useTheme } from '../hooks/useTheme';
import { LinearGradient } from 'expo-linear-gradient';

// --- Types / props ---
interface CardProps {
  children: React.ReactNode;
  variant?: 'default' | 'elevated' | 'outlined' | 'glass' | 'gradient';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  style?: ViewStyle;
  gradientColors?: readonly [string, string, ...string[]];
}

// --- Main component ---
export function Card({
  children,
  variant = 'default',
  padding = 'md',
  style,
  gradientColors,
}: CardProps) {
  const { colors, isDark } = useTheme();

  const paddingMap = {
    none: 0,
    sm: Spacing.sm,
    md: Spacing.md,
    lg: Spacing.lg,
  };

  const variantStyles = {
    default: {
      backgroundColor: colors.surface,
      borderWidth: 0,
      borderColor: undefined as string | undefined,
      shadow: isDark ? undefined : Shadows.sm,
    },
    elevated: {
      backgroundColor: colors.surfaceElevated,
      borderWidth: 0,
      borderColor: undefined as string | undefined,
      shadow: isDark ? Shadows.md : Shadows.lg,
    },
    outlined: {
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      shadow: undefined,
    },
    glass: {
      backgroundColor: isDark ? 'rgba(20, 20, 22, 0.60)' : 'rgba(255, 255, 255, 0.70)',
      borderWidth: 1,
      borderColor: colors.glassBorder,
      shadow: isDark ? Shadows.md : Shadows.lg,
    },
    gradient: {
      backgroundColor: 'transparent',
      borderWidth: 0,
      borderColor: undefined as string | undefined,
      shadow: Shadows.warm,
    },
  };

  const v = variantStyles[variant];

  const cardContent = (
    <View
      style={[
        styles.card,
        {
          backgroundColor: v.backgroundColor,
          borderWidth: v.borderWidth,
          borderColor: v.borderColor,
          padding: paddingMap[padding],
          borderRadius: BorderRadius.lg,
        },
        v.shadow,
        style,
      ]}
    >
      {children}
    </View>
  );

  if (variant === 'gradient' && gradientColors) {
    return (
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.card,
          {
            borderRadius: BorderRadius.lg,
            padding: paddingMap[padding],
          },
          v.shadow,
          style,
        ]}
      >
        {children}
      </LinearGradient>
    );
  }

  return cardContent;
}

// --- Styles ---
const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
  },
});
