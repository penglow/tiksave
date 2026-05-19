/**
 * VideoDetailScreen
 *
 * Full metadata view for a single saved TikTok. Reachable from Library, Inbox,
 * Search, Folders, and Category stacks via `VideoDetail` route param `item`.
 * Supports open-in-TikTok and delete-with-confirmation.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Linking,
  Alert,
  ActivityIndicator,
  Platform,
  Image,
  ScrollView,
  type TextStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

import { Spacing, BorderRadius, Typography, Hairline, Gradients, Shadows, TAB_BAR_OVERLAP } from '../config';
import { getDisplayTitle } from '../types';
import { apiService } from '../services/api';
import { InboxStackScreenProps } from '../navigation/types';
import { useTheme } from '../hooks/useTheme';
import { useResolvedTikTokThumbnail } from '../hooks/useResolvedTikTokThumbnail';
import { AnimatedPressable, AnimatedListItem, Badge } from '../components';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type Props =
  | InboxStackScreenProps<'VideoDetail'>
  | { route: { params: { item: import('../types').SaveItem } }; navigation: any };

// -----------------------------------------------------------------------------
// Main screen
// -----------------------------------------------------------------------------

export default function VideoDetailScreen({ route, navigation }: Props) {
  const { item } = route.params;
  const { colors, isDark } = useTheme();

  // --- UI state -------------------------------------------------------------

  const [isDeleting, setIsDeleting] = useState(false);

  // --- Handlers -------------------------------------------------------------

  const openInTikTok = useCallback(() => {
    Linking.openURL(item.sourceURL);
  }, [item.sourceURL]);

  const performDelete = useCallback(async () => {
    setIsDeleting(true);
    try {
      await apiService.deleteItem(item.id);
      navigation.goBack();
    } catch (error) {
      console.error('Failed to delete:', error);
      if (Platform.OS === 'web') {
        window.alert('Failed to delete video.');
      } else {
        Alert.alert('Error', 'Failed to delete video.');
      }
    } finally {
      setIsDeleting(false);
    }
  }, [item.id, navigation]);

  const handleDelete = useCallback(() => {
    if (Platform.OS === 'web') {
      if (window.confirm('Delete this video?')) {
        performDelete();
      }
    } else {
      Alert.alert('Delete Video', 'Are you sure?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: performDelete },
      ]);
    }
  }, [performDelete]);

  // --- Derived ----------------------------------------------------------------

  const gradientColors = isDark ? Gradients.heroDark : Gradients.heroLight;
  const thumbnailUri = useResolvedTikTokThumbnail(item.sourceURL, item.thumbnailURL);
  /** Keeps drag-to-scroll working on web (text selection steals pointer dragging). */
  const webScrollAssist: TextStyle | undefined =
    Platform.OS === 'web' ? { userSelect: 'none' } : undefined;

  // --- Render -----------------------------------------------------------------

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      nestedScrollEnabled
      keyboardShouldPersistTaps="handled"
      scrollEventThrottle={16}
    >
      {/* Hero Video Preview */}
      <Animated.View entering={FadeIn.duration(200)} style={styles.heroContainer}>
        <LinearGradient colors={gradientColors} style={styles.heroGradient}>
          <AnimatedPressable
            style={styles.previewWrapper}
            onPress={openInTikTok}
            scaleOnPress={0.97}
          >
            {thumbnailUri ? (
              <Image
                source={{ uri: thumbnailUri, cache: 'force-cache' }}
                style={styles.previewImage}
                resizeMode="cover"
              />
            ) : (
              <View style={[styles.previewPlaceholder, { backgroundColor: colors.surfaceHover }]}>
                <Ionicons name="play" size={32} color={colors.textTertiary} />
              </View>
            )}

            {/* Play Overlay */}
            <View style={styles.previewOverlay}>
              <View style={[styles.playCircle, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
                <Ionicons name="play" size={24} color="#ffffff" />
              </View>
            </View>
          </AnimatedPressable>
        </LinearGradient>
      </Animated.View>

      {/* Title Section */}
      <AnimatedListItem index={0} direction="fade">
        <View style={styles.titleSection}>
          <Text
            selectable={false}
            style={[styles.title, { color: colors.text }, webScrollAssist]}
          >
            {getDisplayTitle(item)}
          </Text>
          {item.creatorUsername && (
            <Text
              selectable={false}
              style={[styles.creator, { color: colors.textSecondary }, webScrollAssist]}
            >
              @{item.creatorUsername}
            </Text>
          )}
        </View>
      </AnimatedListItem>

      {/* Quick Actions */}
      <AnimatedListItem index={1} direction="fade">
        <View style={styles.quickActions}>
          <AnimatedPressable
            style={[styles.primaryButton, { backgroundColor: colors.text }]}
            onPress={openInTikTok}
            haptic
          >
            <Ionicons name="logo-tiktok" size={18} color={colors.background} />
            <Text style={[styles.primaryButtonText, { color: colors.background }]}>
              Open in TikTok
            </Text>
          </AnimatedPressable>
        </View>
      </AnimatedListItem>

      {/* Info Section */}
      <AnimatedListItem index={2} direction="fade">
        <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {/* Folder */}
          {item.folderName && (
            <View style={[styles.infoRow, { borderBottomColor: colors.border }]}>
              <View style={styles.infoRowLeft}>
                <Ionicons name="folder-outline" size={16} color={colors.textTertiary} />
                <Text style={[styles.infoLabel, { color: colors.textTertiary }]}>Folder</Text>
              </View>
              <Text
                selectable={false}
                style={[styles.infoValue, { color: colors.text }, webScrollAssist]}
              >
                {item.folderName}
              </Text>
            </View>
          )}

          {/* Topics */}
          {item.detectedTopics.length > 0 && (
            <View style={[styles.infoRow, { borderBottomColor: colors.border }]}>
              <View style={styles.infoRowLeft}>
                <Ionicons name="pricetags-outline" size={16} color={colors.textTertiary} />
                <Text style={[styles.infoLabel, { color: colors.textTertiary }]}>Topics</Text>
              </View>
              <View style={styles.tagsContainer}>
                {item.detectedTopics.map((topic) => (
                  <Badge key={topic} label={topic} variant="ghost" size="sm" />
                ))}
              </View>
            </View>
          )}

          {/* Labels */}
          {item.detectedLabels.length > 0 && (
            <View style={[styles.infoRow, { borderBottomColor: colors.border }]}>
              <View style={styles.infoRowLeft}>
                <Ionicons name="bookmark-outline" size={16} color={colors.textTertiary} />
                <Text style={[styles.infoLabel, { color: colors.textTertiary }]}>Labels</Text>
              </View>
              <View style={styles.tagsContainer}>
                {item.detectedLabels.slice(0, 8).map((label) => (
                  <Badge key={label} label={label} variant="ghost" size="sm" />
                ))}
              </View>
            </View>
          )}

          {/* Confidence */}
          {item.confidence !== undefined && item.confidence !== null && item.confidence > 0 && (
            <View style={[styles.infoRow, { borderBottomColor: colors.border }]}>
              <View style={styles.infoRowLeft}>
                <Ionicons name="analytics-outline" size={16} color={colors.textTertiary} />
                <Text style={[styles.infoLabel, { color: colors.textTertiary }]}>Confidence</Text>
              </View>
              <View style={styles.confidenceRow}>
                <View style={[styles.confidenceBar, { backgroundColor: colors.surfaceHover }]}>
                  <View
                    style={[
                      styles.confidenceFill,
                      {
                        width: `${item.confidence * 100}%`,
                        backgroundColor: item.confidence >= 0.85
                          ? colors.success
                          : item.confidence >= 0.6
                            ? colors.warning
                            : colors.error,
                      },
                    ]}
                  />
                </View>
                <Text selectable={false} style={[styles.confidenceText, { color: colors.textTertiary }, webScrollAssist]}>
                  {Math.round(item.confidence * 100)}%
                </Text>
              </View>
            </View>
          )}

          {/* Location */}
          {item.locationName && (
            <View style={styles.infoRow}>
              <View style={styles.infoRowLeft}>
                <Ionicons name="location-outline" size={16} color={colors.textTertiary} />
                <Text style={[styles.infoLabel, { color: colors.textTertiary }]}>Location</Text>
              </View>
              <View style={styles.locationContainer}>
                <Text selectable={false} style={[styles.infoValue, { color: colors.text }, webScrollAssist]}>
                  {item.locationName}
                </Text>
                {item.address && (
                  <Text
                    selectable={false}
                    style={[styles.addressText, { color: colors.textTertiary }, webScrollAssist]}
                  >
                    {item.address}
                  </Text>
                )}
              </View>
            </View>
          )}
        </View>
      </AnimatedListItem>

      {/* Map Action */}
      {item.latitude && item.longitude && (
        <AnimatedListItem index={3} direction="fade">
          <AnimatedPressable
            style={[styles.outlineButton, { borderColor: colors.border, backgroundColor: colors.surface }]}
            onPress={() => {
              const lat = item.latitude;
              const lng = item.longitude;
              const label = item.locationName || 'Location';
              const url = Platform.select({
                ios: `maps:0,0?q=${label}@${lat},${lng}`,
                android: `geo:0,0?q=${lat},${lng}(${label})`
              });
              if (url) Linking.openURL(url);
            }}
            haptic
          >
            <Ionicons name="map-outline" size={18} color={colors.textSecondary} />
            <Text style={[styles.outlineButtonText, { color: colors.textSecondary }]}>
              Open in Maps
            </Text>
          </AnimatedPressable>
        </AnimatedListItem>
      )}

      {/* Description Section */}
      {item.rawSharedText && (
        <AnimatedListItem index={4} direction="fade">
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.textTertiary }, webScrollAssist]}>DESCRIPTION</Text>
            <View style={[styles.textCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text
                selectable={false}
                style={[styles.descriptionText, { color: colors.textSecondary }, webScrollAssist]}
              >
                {item.rawSharedText}
              </Text>
            </View>
          </View>
        </AnimatedListItem>
      )}

      {/* Transcript */}
      {item.transcriptText && (
        <AnimatedListItem index={5} direction="fade">
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.textTertiary }, webScrollAssist]}>TRANSCRIPT</Text>
            <View style={[styles.textCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text
                selectable={false}
                style={[styles.transcriptText, { color: colors.textSecondary }, webScrollAssist]}
                numberOfLines={10}
              >
                {item.transcriptText}
              </Text>
            </View>
          </View>
        </AnimatedListItem>
      )}

      {/* Delete Action */}
      <AnimatedListItem index={6} direction="fade">
        <AnimatedPressable
          style={[styles.deleteButton, { borderColor: colors.errorSubtle }]}
          onPress={handleDelete}
          disabled={isDeleting}
        >
          {isDeleting ? (
            <ActivityIndicator size="small" color={colors.error} />
          ) : (
            <>
              <Ionicons name="trash-outline" size={16} color={colors.error} />
              <Text style={[styles.deleteButtonText, { color: colors.error }]}>
                Delete Video
              </Text>
            </>
          )}
        </AnimatedPressable>
      </AnimatedListItem>
    </ScrollView>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 0,
  },
  content: {
    paddingBottom: Spacing.xxl + TAB_BAR_OVERLAP,
    gap: Spacing.lg,
  },
  heroContainer: {
    width: '100%',
  },
  heroGradient: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.md,
  },
  previewWrapper: {
    width: 200,
    aspectRatio: 9 / 16,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    position: 'relative',
    ...Shadows.md,
    borderWidth: 1,
    borderColor: 'rgba(128, 128, 128, 0.15)',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  previewPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.20)',
  },
  playCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleSection: {
    paddingHorizontal: Spacing.md,
    gap: Spacing.xs,
  },
  title: {
    ...Typography.displaySm,
    lineHeight: 30,
  },
  creator: {
    ...Typography.body,
  },
  quickActions: {
    paddingHorizontal: Spacing.md,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.sm,
  },
  primaryButtonText: {
    ...Typography.bodyStrong,
  },
  infoCard: {
    marginHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    ...Shadows.xs,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: Hairline,
    gap: Spacing.md,
  },
  infoRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    minWidth: 90,
  },
  infoLabel: {
    ...Typography.captionStrong,
  },
  infoValue: {
    ...Typography.body,
    flex: 1,
    textAlign: 'right',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    justifyContent: 'flex-end',
    flex: 1,
  },
  confidenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
    justifyContent: 'flex-end',
  },
  confidenceBar: {
    width: 100,
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  confidenceFill: {
    height: '100%',
    borderRadius: 2,
  },
  confidenceText: {
    ...Typography.caption,
    width: 35,
    textAlign: 'right',
  },
  locationContainer: {
    alignItems: 'flex-end',
    flex: 1,
    gap: 2,
  },
  addressText: {
    ...Typography.caption,
    fontSize: 12,
    textAlign: 'right',
  },
  section: {
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  sectionLabel: {
    ...Typography.label,
  },
  textCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    ...Shadows.xs,
  },
  descriptionText: {
    ...Typography.body,
    lineHeight: 24,
  },
  transcriptText: {
    ...Typography.bodySm,
    lineHeight: 22,
  },
  outlineButton: {
    marginHorizontal: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  outlineButtonText: {
    ...Typography.bodyStrong,
  },
  deleteButton: {
    marginHorizontal: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
  },
  deleteButtonText: {
    ...Typography.body,
  },
});
