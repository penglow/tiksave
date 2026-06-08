/**
 * Pill-shaped search field with optional filter button — matches mockup chrome.
 */

import React from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  TextInputProps,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Spacing, BorderRadius, Typography, Shadows } from '../config';
import { useTheme } from '../hooks/useTheme';
import { AnimatedPressable } from './AnimatedPressable';

interface GlassSearchBarProps extends Pick<TextInputProps, 'value' | 'onChangeText' | 'placeholder' | 'onSubmitEditing' | 'onFocus' | 'onBlur' | 'returnKeyType' | 'accessibilityLabel'> {
  onFilterPress?: () => void;
  filterAccessibilityLabel?: string;
  containerStyle?: ViewStyle;
}

export function GlassSearchBar({
  value,
  onChangeText,
  placeholder = 'Search...',
  onSubmitEditing,
  onFocus,
  onBlur,
  returnKeyType = 'search',
  accessibilityLabel,
  onFilterPress,
  filterAccessibilityLabel = 'Filter',
  containerStyle,
}: GlassSearchBarProps) {
  const { colors } = useTheme();

  return (
    <View style={[styles.row, containerStyle]}>
      <View
        style={[
          styles.field,
          {
            backgroundColor: colors.inputBackground,
            borderColor: colors.glassBorder,
          },
          Shadows.glass,
        ]}
      >
        <Ionicons name="search" size={18} color={colors.textTertiary} />
        <TextInput
          style={[styles.input, { color: colors.text }]}
          placeholder={placeholder}
          placeholderTextColor={colors.textQuaternary}
          value={value}
          onChangeText={onChangeText}
          onSubmitEditing={onSubmitEditing}
          onFocus={onFocus}
          onBlur={onBlur}
          returnKeyType={returnKeyType}
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel={accessibilityLabel ?? placeholder}
        />
      </View>
      {onFilterPress ? (
        <AnimatedPressable
          onPress={onFilterPress}
          style={[
            styles.filterBtn,
            {
              backgroundColor: colors.glassStrong,
              borderColor: colors.glassBorder,
            },
            Shadows.glass,
          ]}
          accessibilityLabel={filterAccessibilityLabel}
        >
          <Ionicons name="options-outline" size={20} color={colors.text} />
        </AnimatedPressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.screen,
    marginBottom: Spacing.sm,
  },
  field: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  input: {
    flex: 1,
    ...Typography.body,
    fontSize: 15,
    padding: 0,
  },
  filterBtn: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
});
