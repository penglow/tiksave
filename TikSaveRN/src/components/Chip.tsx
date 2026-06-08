/**
 * Selectable or static pill label with optional icon and dismiss control.
 * Used for filters, tags, and removable URL chips in lists and import flows.
 */

import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BorderRadius, Typography } from '../config';
import { useTheme } from '../hooks/useTheme';
import { AnimatedPressable } from './AnimatedPressable';

// --- Types / props ---
interface ChipProps {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  selected?: boolean;
  onPress?: () => void;
  onRemove?: () => void;
  style?: ViewStyle;
  disabled?: boolean;
}

// --- Main component ---
export function Chip({ label, icon, selected, onPress, onRemove, style, disabled }: ChipProps) {
  const { colors } = useTheme();
  const selectedFg = selected ? colors.tabActiveIcon : colors.text;
  const selectedIconFg = selected ? colors.tabActiveIcon : colors.textSecondary;

  const isInteractive = !!onPress || !!onRemove;

  const content = (
    <View
      style={[
        styles.chip,
        {
          backgroundColor: selected ? colors.tabActive : colors.glassStrong,
          borderColor: selected ? colors.tabActive : colors.glassBorder,
        },
        !isInteractive && styles.chipStatic,
        style,
      ]}
    >
      {icon && (
        <Ionicons
          name={icon}
          size={13}
          color={selectedIconFg}
          style={styles.icon}
        />
      )}
      <Text style={[styles.label, { color: selectedFg }]}>
        {label}
      </Text>
      {onRemove && (
        <AnimatedPressable onPress={onRemove} style={styles.removeButton} noScale>
          <Ionicons name="close-circle" size={14} color={colors.textTertiary} />
        </AnimatedPressable>
      )}
    </View>
  );

  if (!isInteractive) return content;

  return (
    <AnimatedPressable onPress={onPress} disabled={disabled} scaleOnPress={0.95} haptic>
      {content}
    </AnimatedPressable>
  );
}

// --- Styles ---
const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    gap: 5,
  },
  chipStatic: {
    borderWidth: 0,
  },
  icon: {
    marginRight: 2,
  },
  label: {
    ...Typography.captionStrong,
    fontSize: 13,
    fontWeight: '600',
  },
  removeButton: {
    marginLeft: 2,
    padding: 2,
  },
});
