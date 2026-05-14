import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Spacing, Typography, Hairline } from '../config';
import { useTheme } from '../hooks/useTheme';
import { AnimatedPressable } from './AnimatedPressable';

interface SectionHeaderProps {
  title: string;
  actionLabel?: string;
  actionIcon?: keyof typeof Ionicons.glyphMap;
  onAction?: () => void;
  variant?: 'default' | 'large';
  style?: ViewStyle;
}

export function SectionHeader({
  title,
  actionLabel,
  actionIcon,
  onAction,
  variant = 'default',
  style,
}: SectionHeaderProps) {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, style]}>
      <Text
        style={[
          variant === 'large' ? styles.titleLarge : styles.title,
          { color: colors.text },
        ]}
      >
        {title}
      </Text>
      {onAction && (
        <AnimatedPressable onPress={onAction} style={styles.action} haptic>
          <Text style={[styles.actionLabel, { color: colors.accent }]}>
            {actionLabel}
          </Text>
          {actionIcon && (
            <Ionicons name={actionIcon} size={14} color={colors.accent} />
          )}
        </AnimatedPressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.screen,
    paddingVertical: Spacing.md,
  },
  title: {
    ...Typography.label,
  },
  titleLarge: {
    ...Typography.headingSm,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionLabel: {
    ...Typography.captionStrong,
    fontWeight: '600',
  },
});
