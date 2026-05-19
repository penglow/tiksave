/**
 * Primary/secondary/ghost call-to-action button with optional icon and gradient fill.
 * Wraps AnimatedPressable for haptic press feedback on native.
 */

import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BorderRadius, Typography, Spacing } from '../config';
import { useTheme } from '../hooks/useTheme';
import { AnimatedPressable } from './AnimatedPressable';
import { Ionicons } from '@expo/vector-icons';

// --- Types / props ---
interface GradientButtonProps {
  children: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  size?: 'sm' | 'md' | 'lg';
  icon?: keyof typeof Ionicons.glyphMap;
  variant?: 'primary' | 'secondary' | 'ghost';
  style?: ViewStyle;
}

// --- Main component ---
export function GradientButton({
  children,
  onPress,
  disabled,
  loading,
  size = 'md',
  icon,
  variant = 'primary',
  style,
}: GradientButtonProps) {
  const { colors, isDark } = useTheme();

  const sizeStyles = {
    sm: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: BorderRadius.sm },
    md: { paddingVertical: 12, paddingHorizontal: 20, borderRadius: BorderRadius.md },
    lg: { paddingVertical: 16, paddingHorizontal: 28, borderRadius: BorderRadius.lg },
  };

  const s = sizeStyles[size];

  if (variant === 'ghost') {
    return (
      <AnimatedPressable
        onPress={onPress}
        disabled={disabled || loading}
        style={[
          styles.button,
          { borderRadius: s.borderRadius, paddingVertical: s.paddingVertical, paddingHorizontal: s.paddingHorizontal },
          { backgroundColor: colors.accentSubtle },
          style,
        ]}
        haptic
      >
        {icon && (
          <Ionicons name={icon} size={size === 'sm' ? 14 : 18} color={colors.accent} style={styles.icon} />
        )}
        <Text style={[styles.text, { color: colors.accent, fontSize: size === 'sm' ? 13 : 15 }]}>
          {children}
        </Text>
      </AnimatedPressable>
    );
  }

  if (variant === 'secondary') {
    return (
      <AnimatedPressable
        onPress={onPress}
        disabled={disabled || loading}
        style={[
          styles.button,
          {
            borderRadius: s.borderRadius,
            paddingVertical: s.paddingVertical,
            paddingHorizontal: s.paddingHorizontal,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
          },
          style,
        ]}
        haptic
      >
        {icon && (
          <Ionicons name={icon} size={size === 'sm' ? 14 : 18} color={colors.text} style={styles.icon} />
        )}
        <Text style={[styles.text, { color: colors.text, fontSize: size === 'sm' ? 13 : 15 }]}>
          {children}
        </Text>
      </AnimatedPressable>
    );
  }

  // Primary: warm gradient tuned per theme
  const gradientColors: [string, string] = isDark
    ? ['#e8705a', '#c45a46']
    : ['#f28b78', '#d45a44'];

  return (
    <AnimatedPressable
      onPress={onPress}
      disabled={disabled || loading}
      style={[{ borderRadius: s.borderRadius, overflow: 'hidden' }, style]}
      haptic
    >
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.button,
          {
            borderRadius: s.borderRadius,
            paddingVertical: s.paddingVertical,
            paddingHorizontal: s.paddingHorizontal,
          },
        ]}
      >
        {icon && (
          <Ionicons name={icon} size={size === 'sm' ? 14 : 18} color="#ffffff" style={styles.icon} />
        )}
        <Text style={[styles.text, { color: '#ffffff', fontSize: size === 'sm' ? 13 : 15 }]}>
          {children}
        </Text>
      </LinearGradient>
    </AnimatedPressable>
  );
}

// --- Styles ---
const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  icon: {
    marginRight: 2,
  },
  text: {
    ...Typography.bodyStrong,
    fontWeight: '700',
  },
});
