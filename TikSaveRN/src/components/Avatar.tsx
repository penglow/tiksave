import React from 'react';
import { View, Text, StyleSheet, Image, ViewStyle } from 'react-native';
import { BorderRadius, Typography } from '../config';
import { useTheme } from '../hooks/useTheme';

interface AvatarProps {
  uri?: string;
  name?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  style?: ViewStyle;
}

export function Avatar({ uri, name, size = 'md', style }: AvatarProps) {
  const { colors } = useTheme();

  const sizeMap = {
    sm: 32,
    md: 44,
    lg: 64,
    xl: 88,
  };

  const s = sizeMap[size];
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
          style,
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
