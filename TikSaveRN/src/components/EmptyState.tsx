/**
 * Centered empty-list placeholder with icon rings, title, subtitle, and optional CTA.
 * Used when library, search, or folder views have no items to show.
 */

import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Spacing, BorderRadius, Typography } from '../config';
import { useTheme } from '../hooks/useTheme';
import { GradientButton } from './GradientButton';

// --- Types / props ---
interface EmptyStateProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  actionIcon?: keyof typeof Ionicons.glyphMap;
  onAction?: () => void;
  style?: ViewStyle;
  variant?: 'default' | 'success' | 'error' | 'neutral';
}

// --- Main component ---
export function EmptyState({
  icon,
  title,
  subtitle,
  actionLabel,
  actionIcon,
  onAction,
  style,
  variant = 'default',
}: EmptyStateProps) {
  const { colors } = useTheme();

  const palette = {
    default: { bg: colors.accentSubtle, fg: colors.accent, ring: colors.accent },
    success: { bg: colors.successSubtle, fg: colors.success, ring: colors.success },
    error: { bg: colors.errorSubtle, fg: colors.error, ring: colors.error },
    neutral: { bg: colors.surfaceHover, fg: colors.textTertiary, ring: colors.border },
  }[variant];

  return (
    <View style={[styles.container, style]}>
      <View style={styles.iconStack}>
        <View style={[styles.iconRing, { borderColor: palette.ring, opacity: 0.18 }]} />
        <View style={[styles.iconRingInner, { borderColor: palette.ring, opacity: 0.32 }]} />
        <View style={[styles.iconWrapper, { backgroundColor: palette.bg }]}>
          <Ionicons name={icon} size={30} color={palette.fg} />
        </View>
      </View>

      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      {subtitle && (
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
      )}

      {actionLabel && onAction && (
        <View style={styles.action}>
          <GradientButton onPress={onAction} icon={actionIcon} size="md">
            {actionLabel}
          </GradientButton>
        </View>
      )}
    </View>
  );
}

// --- Styles ---
const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.xxl,
  },
  iconStack: {
    width: 132,
    height: 132,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  iconRing: {
    position: 'absolute',
    width: 132,
    height: 132,
    borderRadius: 66,
    borderWidth: 1,
  },
  iconRingInner: {
    position: 'absolute',
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 1,
  },
  iconWrapper: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...Typography.displaySm,
    fontSize: 22,
    lineHeight: 28,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  subtitle: {
    ...Typography.body,
    textAlign: 'center',
    marginBottom: Spacing.lg,
    maxWidth: 320,
    opacity: 0.9,
  },
  action: {
    marginTop: Spacing.sm,
  },
});
