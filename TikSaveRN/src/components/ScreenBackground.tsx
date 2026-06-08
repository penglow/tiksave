/**
 * Full-screen pastel mesh backdrop used behind main tab screens.
 */

import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { MeshBlobs } from '../config';
import { useTheme } from '../hooks/useTheme';
import { GradientMesh } from './GradientMesh';

interface ScreenBackgroundProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export function ScreenBackground({ children, style }: ScreenBackgroundProps) {
  const { colors, isDark } = useTheme();
  const blobs = isDark ? MeshBlobs.dark : MeshBlobs.light;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }, style]}>
      <GradientMesh blobs={[...blobs]} />
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    position: 'relative',
  },
  content: {
    flex: 1,
    minHeight: 0,
  },
});
