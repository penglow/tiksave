/**
 * Library grid card with frosted bottom overlay — matches redesign mockups.
 */

import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Platform } from 'react-native';

import { BorderRadius, Spacing, Typography, Shadows } from '../config';
import { SaveItem, getDisplayTitle } from '../types';
import { useTheme } from '../hooks/useTheme';
import { useResolvedTikTokThumbnail } from '../hooks/useResolvedTikTokThumbnail';
interface GridVideoCardProps {
  item: SaveItem;
  onPress: () => void;
  topicLabel?: string;
  featureLabel?: string;
  confidence?: number;
}

export function GridVideoCard({
  item,
  onPress,
  topicLabel,
  featureLabel,
  confidence,
}: GridVideoCardProps) {
  const { colors, isDark } = useTheme();
  const title = getDisplayTitle(item);
  const thumbUri = useResolvedTikTokThumbnail(item.sourceURL, item.thumbnailURL);
  const topic = topicLabel ?? item.detectedTopics?.[0]?.split(' > ')[0] ?? 'Saved';
  const conf = confidence ?? (item.confidence != null ? Math.round(item.confidence * 100) : null);

  const duration =
    item.duration != null
      ? `${Math.floor(item.duration / 60)}:${String(Math.floor(item.duration % 60)).padStart(2, '0')}`
      : null;

  return (
    <TouchableOpacity activeOpacity={0.92} onPress={onPress} style={styles.card}>
      <View style={styles.thumbWrap}>
        {thumbUri ? (
          <Image source={{ uri: thumbUri }} style={styles.thumb} resizeMode="cover" />
        ) : (
          <View style={[styles.thumbPlaceholder, { backgroundColor: colors.surfaceHover }]}>
            <Ionicons name="play" size={28} color={colors.textTertiary} />
          </View>
        )}
        {duration ? (
          <View style={styles.duration}>
            <Text style={styles.durationText}>{duration}</Text>
          </View>
        ) : null}
        <View style={styles.overlay}>
          {Platform.OS !== 'android' ? (
            <BlurView
              intensity={28}
              tint={isDark ? 'dark' : 'light'}
              style={StyleSheet.absoluteFill}
            />
          ) : null}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.55)']}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.overlayContent}>
            <View style={styles.overlayTop}>
              <View style={styles.overlayText}>
                <Text style={styles.overlayTitle} numberOfLines={2}>
                  {title}
                </Text>
                {item.creatorUsername ? (
                  <Text style={styles.overlayUser}>@{item.creatorUsername}</Text>
                ) : null}
              </View>
              <Ionicons name="bookmark-outline" size={18} color="rgba(255,255,255,0.9)" />
            </View>
            <View style={styles.tagRow}>
              <View style={styles.tag}>
                <Ionicons name="folder-outline" size={11} color="#fff" />
                <Text style={styles.tagText}>{topic}</Text>
              </View>
              {featureLabel ? (
                <View style={[styles.tag, styles.tagMuted]}>
                  <Ionicons name="sparkles" size={11} color="#fff" />
                  <Text style={styles.tagText}>{featureLabel}</Text>
                </View>
              ) : null}
            </View>
            {conf != null ? (
              <View style={styles.footer}>
                <Text style={styles.indexed}>Indexed</Text>
                <View style={styles.confRow}>
                  <View style={styles.confDot} />
                  <Text style={styles.confText}>{conf}% confidence</Text>
                </View>
              </View>
            ) : null}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 0,
    ...Shadows.glass,
  },
  thumbWrap: {
    aspectRatio: 3 / 4,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    backgroundColor: '#111',
  },
  thumb: {
    width: '100%',
    height: '100%',
  },
  thumbPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  duration: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.xs,
  },
  durationText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    minHeight: '48%',
    justifyContent: 'flex-end',
  },
  overlayContent: {
    padding: Spacing.sm,
    gap: 6,
  },
  overlayTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.xs,
  },
  overlayText: {
    flex: 1,
  },
  overlayTitle: {
    ...Typography.captionStrong,
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 17,
  },
  overlayUser: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 2,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.22)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  tagMuted: {
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  tagText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#fff',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  indexed: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.65)',
  },
  confRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  confDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#4ade80',
  },
  confText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#4ade80',
  },
});
