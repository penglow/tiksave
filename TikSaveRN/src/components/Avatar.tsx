/**
 * Circular user avatar from image URI or initials fallback.
 * Used in settings and profile-adjacent UI.
 */

import React from 'react';
import { View, Text, StyleSheet, Image, ViewStyle, ImageStyle } from 'react-native';
import { BorderRadius, Typography } from '../config';
import { useTheme } from '../hooks/useTheme';

// --- Types / props ---
interface AvatarProps {
  uri?: string;
  name?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  style?: ViewStyle | ImageStyle;
}

// --- Constants ---
const SIZE_MAP = {
  sm: 32,
  md: 44,
  lg: 64,
  xl: 88,
} as const;

// --- Main component ---
export function Avatar({ uri, name, size = 'md', style }: AvatarProps) {
  const { colors } = useTheme();

  const s = SIZE_MAP[size];
  const fontSize = s * 0.4;

  const initials = name
    ? name
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : '?';

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[
          styles.avatar,
          { width: s, height: s, borderRadius: s / 2 },
          style as any,
        ]}
      />
    );
  }

  return (
    <View
      style={[
        styles.avatar,
        {
          width: s,
          height: s,
          borderRadius: s / 2,
          backgroundColor: colors.accentSubtle,
        },
        style,
      ]}
    >
      <Text style={[styles.initials, { color: colors.accent, fontSize }]}>
        {initials}
      </Text>
    </View>
  );
}

// --- Styles ---
const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  initials: {
    ...Typography.bodyStrong,
    fontWeight: '700',
  },
});
