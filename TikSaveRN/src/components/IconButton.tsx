/**
 * Square icon-only pressable with size and visual variant presets.
 * Built on AnimatedPressable for consistent tap feedback across the app.
 */

import React from 'react';
import { StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BorderRadius } from '../config';
import { useTheme } from '../hooks/useTheme';
import { AnimatedPressable } from './AnimatedPressable';

// --- Types / props ---
interface IconButtonProps {
  icon: keyof typeof Ionicons.glyphMap;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'filled' | 'outlined' | 'ghost';
  color?: string;
  onPress?: () => void;
  disabled?: boolean;
  style?: ViewStyle;
}

// --- Main component ---
export function IconButton({
  icon,
  size = 'md',
  variant = 'default',
  color,
  onPress,
  disabled,
  style,
}: IconButtonProps) {
  const { colors } = useTheme();

  const sizeMap = {
    sm: { container: 32, icon: 16 },
    md: { container: 40, icon: 20 },
    lg: { container: 52, icon: 24 },
  };

  const s = sizeMap[size];
  const iconColor = color || colors.text;

  const variantStyles = {
    default: { backgroundColor: 'transparent', borderWidth: 0, borderColor: 'transparent' },
    filled: { backgroundColor: colors.surface, borderWidth: 0, borderColor: 'transparent' },
    outlined: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border },
    ghost: { backgroundColor: colors.accentSubtle, borderWidth: 0, borderColor: 'transparent' },
  };

  const v = variantStyles[variant];

  return (
    <AnimatedPressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.button,
        {
          width: s.container,
          height: s.container,
          borderRadius: BorderRadius.md,
          backgroundColor: v.backgroundColor,
          borderWidth: v.borderWidth ?? 0,
          borderColor: v.borderColor,
        },
        style,
      ]}
      haptic
    >
      <Ionicons name={icon} size={s.icon} color={variant === 'ghost' ? colors.accent : iconColor} />
    </AnimatedPressable>
  );
}

// --- Styles ---
const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
