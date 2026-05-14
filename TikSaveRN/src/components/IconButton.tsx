import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BorderRadius, Spacing } from '../config';
import { useTheme } from '../hooks/useTheme';
import { AnimatedPressable } from './AnimatedPressable';

interface IconButtonProps {
  icon: keyof typeof Ionicons.glyphMap;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'filled' | 'outlined' | 'ghost';
  color?: string;
  onPress?: () => void;
  disabled?: boolean;
  style?: ViewStyle;
}

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
    default: { backgroundColor: 'transparent' },
    filled: { backgroundColor: colors.surface },
    outlined: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border },
    ghost: { backgroundColor: colors.accentSubtle },
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

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
