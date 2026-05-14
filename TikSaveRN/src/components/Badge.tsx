import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { BorderRadius, Typography, Spacing } from '../config';
import { useTheme } from '../hooks/useTheme';

interface BadgeProps {
  label: string;
  variant?: 'default' | 'accent' | 'success' | 'warning' | 'error' | 'ghost';
  size?: 'sm' | 'md';
  style?: ViewStyle;
}

export function Badge({ label, variant = 'default', size = 'sm', style }: BadgeProps) {
  const { colors } = useTheme();

  const variantStyles = {
    default: {
      backgroundColor: colors.surfaceHover,
      color: colors.textSecondary,
    },
    accent: {
      backgroundColor: colors.accentSubtle,
      color: colors.accent,
    },
    success: {
      backgroundColor: colors.successSubtle,
      color: colors.success,
    },
    warning: {
      backgroundColor: colors.warningSubtle,
      color: colors.warning,
    },
    error: {
      backgroundColor: colors.errorSubtle,
      color: colors.error,
    },
    ghost: {
      backgroundColor: 'transparent',
      color: colors.textTertiary,
    },
  };

  const v = variantStyles[variant];
  const isGhost = variant === 'ghost';

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: v.backgroundColor,
          borderWidth: isGhost ? 1 : 0,
          borderColor: colors.border,
          paddingVertical: size === 'sm' ? 3 : 5,
          paddingHorizontal: size === 'sm' ? 8 : 12,
          borderRadius: size === 'sm' ? BorderRadius.sm : BorderRadius.md,
        },
        style,
      ]}
    >
      <Text
        style={[
          styles.label,
          {
            color: v.color,
            fontSize: size === 'sm' ? 11 : 13,
          },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
  },
  label: {
    ...Typography.captionStrong,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
