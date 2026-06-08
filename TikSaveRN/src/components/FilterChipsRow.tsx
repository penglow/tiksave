/**
 * Horizontally scrollable filter pills (All, Food, Travel, …).
 */

import React from 'react';
import { ScrollView, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Spacing } from '../config';
import { Chip } from './Chip';

export interface FilterChipOption {
  id: string;
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
}

interface FilterChipsRowProps {
  options: FilterChipOption[];
  selectedId: string;
  onSelect: (id: string) => void;
  style?: ViewStyle;
}

export function FilterChipsRow({ options, selectedId, onSelect, style }: FilterChipsRowProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.content, style]}
      style={styles.scroll}
    >
      {options.map((opt) => (
        <Chip
          key={opt.id}
          label={opt.label}
          icon={opt.icon}
          selected={selectedId === opt.id}
          onPress={() => onSelect(opt.id)}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 0,
    marginBottom: Spacing.md,
  },
  content: {
    paddingHorizontal: Spacing.screen,
    gap: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
  },
});
