/**
 * Inline TikTok URL preview row for the import screen (thumbnail, title, remove).
 * Shown below the paste field while oEmbed metadata loads.
 */

import React from 'react';
import { View, Text, Image, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Spacing, BorderRadius, Typography, Shadows } from '../config';
import { useTheme } from '../hooks/useTheme';
import { AnimatedPressable } from './AnimatedPressable';
import type { TikTokOEmbedPreview } from '../utils/tiktokOEmbed';

// --- Types / props ---
interface UrlPreviewChipProps {
  url: string;
  preview?: TikTokOEmbedPreview;
  loading: boolean;
  onRemove: () => void;
}

// --- Main component ---
export function UrlPreviewChip({ url, preview, loading, onRemove }: UrlPreviewChipProps) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.row,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <View style={[styles.thumb, { backgroundColor: colors.surfaceHover }]}>
        {preview?.thumbnailUrl ? (
          <Image source={{ uri: preview.thumbnailUrl }} style={styles.thumbImage} />
        ) : loading ? (
          <ActivityIndicator size="small" color={colors.textTertiary} />
        ) : (
          <Ionicons name="play-circle-outline" size={18} color={colors.textTertiary} />
        )}
      </View>

      <View style={styles.text}>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
          {preview?.title || 'TikTok video'}
        </Text>
        <Text style={[styles.url, { color: colors.textTertiary }]} numberOfLines={1}>
          {url}
        </Text>
      </View>

      <AnimatedPressable
        onPress={onRemove}
        accessibilityLabel={`Remove ${preview?.title || url}`}
        accessibilityRole="button"
        style={styles.remove}
      >
        <Ionicons name="close" size={16} color={colors.textTertiary} />
      </AnimatedPressable>
    </View>
  );
}

// --- Styles ---
const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingLeft: Spacing.sm,
    paddingRight: Spacing.xs,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    ...Shadows.xs,
  },
  thumb: {
    width: 36,
    height: 48,
    borderRadius: BorderRadius.sm,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  text: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    ...Typography.captionStrong,
    lineHeight: 16,
  },
  url: {
    ...Typography.caption,
    fontSize: 11,
    marginTop: 2,
  },
  remove: {
    padding: Spacing.xs,
  },
});

export default UrlPreviewChip;
