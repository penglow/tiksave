import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Linking,
  Alert,
  ActivityIndicator,
  Platform,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Spacing, BorderRadius, Typography, Hairline } from '../config';
import { getDisplayTitle } from '../types';
import { apiService } from '../services/api';
import { InboxStackScreenProps } from '../navigation/types';
import { useTheme } from '../hooks/useTheme';
import { AnimatedPressable, AnimatedListItem, AnimatedText } from '../components';

type Props =
  | InboxStackScreenProps<'VideoDetail'>
  | { route: { params: { item: import('../types').SaveItem } }; navigation: any };

export default function VideoDetailScreen({ route, navigation }: Props) {
  const { item } = route.params;
  const { colors } = useTheme();
  const [isDeleting, setIsDeleting] = useState(false);

  const openInTikTok = () => {
    Linking.openURL(item.sourceURL);
  };

  const performDelete = async () => {
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
  };

  const handleDelete = () => {
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
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Video Preview */}
      <Animated.View entering={FadeIn.duration(150)} style={styles.previewContainer}>
        <AnimatedPressable
          style={styles.previewWrapper}
          onPress={openInTikTok}
          scaleOnPress={0.98}
        >
          {item.thumbnailURL ? (
            <Image
              source={{ uri: item.thumbnailURL, cache: 'force-cache' }}
              style={styles.previewImage}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.previewPlaceholder, { backgroundColor: colors.accentSubtle }]}>
              <Ionicons name="play" size={32} color={colors.textTertiary} />
            </View>
          )}

          {/* Play Overlay */}
          <View style={styles.previewOverlay}>
            <View style={[styles.playCircle, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
              <Ionicons name="play" size={24} color="#ffffff" />
            </View>
            <Text style={styles.openText}>Open in TikTok</Text>
          </View>
        </AnimatedPressable>
      </Animated.View>

      {/* Title Section */}
      <AnimatedListItem index={0} direction="fade">
        <View style={styles.section}>
          <AnimatedText style={[styles.title, { color: colors.text }]}>
            {getDisplayTitle(item)}
          </AnimatedText>
          {item.creatorUsername && (
            <Text style={[styles.creator, { color: colors.textSecondary }]}>
              @{item.creatorUsername}
            </Text>
          )}
        </View>
      </AnimatedListItem>

      {/* Info Section */}
      <AnimatedListItem index={1} direction="fade">
        <View style={[styles.infoSection, { borderTopColor: colors.border }]}>
          {/* Folder */}
          {item.folderName && (
            <View style={[styles.infoRow, { borderBottomColor: colors.border }]}>
              <Text style={[styles.infoLabel, { color: colors.textTertiary }]}>FOLDER</Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>{item.folderName}</Text>
            </View>
          )}

          {/* Topics */}
          {item.detectedTopics.length > 0 && (
            <View style={[styles.infoRow, { borderBottomColor: colors.border }]}>
              <Text style={[styles.infoLabel, { color: colors.textTertiary }]}>TOPICS</Text>
              <View style={styles.tagsContainer}>
                {item.detectedTopics.map((topic) => (
                  <Text key={topic} style={[styles.tagText, { color: colors.textSecondary }]}>
                    {topic}
                  </Text>
                ))}
              </View>
            </View>
          )}

          {/* Labels */}
          {item.detectedLabels.length > 0 && (
            <View style={[styles.infoRow, { borderBottomColor: colors.border }]}>
              <Text style={[styles.infoLabel, { color: colors.textTertiary }]}>LABELS</Text>
              <View style={styles.tagsContainer}>
                {item.detectedLabels.slice(0, 8).map((label) => (
                  <View key={label} style={[styles.labelBadge, { borderColor: colors.border }]}>
                    <Text style={[styles.labelText, { color: colors.textTertiary }]}>{label}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Confidence */}
          {item.confidence !== undefined && item.confidence !== null && item.confidence > 0 && (
            <View style={[styles.infoRow, { borderBottomColor: colors.border }]}>
              <Text style={[styles.infoLabel, { color: colors.textTertiary }]}>CONFIDENCE</Text>
              <View style={styles.confidenceRow}>
                <View style={[styles.confidenceBar, { backgroundColor: colors.accentSubtle }]}>
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
                <Text style={[styles.confidenceText, { color: colors.textTertiary }]}>
                  {Math.round(item.confidence * 100)}%
                </Text>
              </View>
            </View>
          )}

          {/* Location */}
          {item.locationName && (
            <View style={[styles.infoRow, { borderBottomColor: colors.border }]}>
              <Text style={[styles.infoLabel, { color: colors.textTertiary }]}>LOCATION</Text>
              <View style={styles.locationContainer}>
                <Ionicons name="location-sharp" size={16} color={colors.primary} />
                <View style={styles.locationInfo}>
                  <Text style={[styles.infoValue, { color: colors.text }]}>{item.locationName}</Text>
                  {item.address && (
                    <Text style={[styles.addressText, { color: colors.textTertiary }]}>{item.address}</Text>
                  )}
                </View>
              </View>
            </View>
          )}
        </View>
      </AnimatedListItem>

      {/* Actions */}
      <AnimatedListItem index={3} direction="fade">
        <View style={styles.actionsSection}>
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

          {item.latitude && item.longitude && (
            <AnimatedPressable
              style={[styles.outlineButton, { borderColor: colors.primary }]}
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
              <Ionicons name="map-outline" size={18} color={colors.primary} />
              <Text style={[styles.outlineButtonText, { color: colors.primary }]}>
                Open in Google Maps
              </Text>
            </AnimatedPressable>
          )}

          <AnimatedPressable
            style={[styles.deleteButton, { borderColor: colors.error }]}
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
        </View>
      </AnimatedListItem>

      {/* Description Section */}
      {item.rawSharedText && (
        <AnimatedListItem index={4} direction="fade">
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>DESCRIPTION</Text>
            <Text style={[styles.descriptionText, { color: colors.textSecondary }]}>
              {item.rawSharedText}
            </Text>
          </View>
        </AnimatedListItem>
      )}

      {/* Transcript */}
      {item.transcriptText && (
        <AnimatedListItem index={5} direction="fade">
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>TRANSCRIPT</Text>
            <Text style={[styles.transcriptText, { color: colors.textSecondary }]} numberOfLines={10}>
              {item.transcriptText}
            </Text>
          </View>
        </AnimatedListItem>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: Spacing.md,
    paddingBottom: Spacing.xxl,
    gap: Spacing.lg,
  },
  previewContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  previewWrapper: {
    width: 180,
    aspectRatio: 9 / 16,
    borderRadius: BorderRadius.sm,
    overflow: 'hidden',
    position: 'relative',
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
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
  },
  playCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  openText: {
    color: '#ffffff',
    ...Typography.captionStrong,
    marginTop: Spacing.sm,
  },
  section: {
    gap: Spacing.xs,
  },
  sectionLabel: {
    ...Typography.label,
    marginBottom: Spacing.xs,
  },
  title: {
    ...Typography.displayMd,
    lineHeight: 28,
  },
  creator: {
    ...Typography.body,
    marginTop: Spacing.xs,
  },
  infoSection: {
    borderTopWidth: Hairline,
  },
  infoRow: {
    paddingVertical: Spacing.md,
    borderBottomWidth: Hairline,
  },
  infoLabel: {
    ...Typography.label,
    marginBottom: Spacing.xs,
  },
  infoValue: {
    ...Typography.body,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  tagText: {
    ...Typography.caption,
  },
  labelBadge: {
    borderWidth: 1,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  labelText: {
    fontSize: 11,
  },
  confidenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  confidenceBar: {
    flex: 1,
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
  },
  transcriptText: {
    ...Typography.bodySm,
    lineHeight: 22,
  },
  actionsSection: {
    gap: Spacing.sm,
    paddingTop: Spacing.md,
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
  outlineButton: {
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
  descriptionText: {
    ...Typography.body,
    lineHeight: 22,
  },
  locationContainer: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  locationInfo: {
    flex: 1,
    gap: 2,
  },
  addressText: {
    ...Typography.caption,
    fontSize: 12,
  },
});
