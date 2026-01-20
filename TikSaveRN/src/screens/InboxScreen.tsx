import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Spacing, BorderRadius, Typography, Hairline } from '../config';
import { SaveItem, getDisplayTitle, isLoadingStatus } from '../types';
import { apiService } from '../services/api';
import { useAppStore } from '../stores/appStore';
import { InboxStackScreenProps } from '../navigation/types';
import { useTheme } from '../hooks/useTheme';
import { AnimatedPressable, AnimatedListItem } from '../components';
import MoveFolderModal from '../components/MoveFolderModal';
import { formatTimeAgo } from '../utils/date';

type Props = InboxStackScreenProps<'InboxMain'>;

export default function InboxScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<SaveItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedItem, setSelectedItem] = useState<SaveItem | null>(null);
  const [showMoveModal, setShowMoveModal] = useState(false);

  const setUnreadInboxCount = useAppStore((state) => state.setUnreadInboxCount);

  const loadItems = useCallback(async () => {
    try {
      const allItems = await apiService.getItems();
      const sorted = allItems.sort(
        (a, b) => new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime()
      );
      setItems(sorted);

      const needsReviewCount = sorted.filter((item) => item.status === 'needs_review').length;
      setUnreadInboxCount(needsReviewCount);
    } catch (error) {
      console.error('Failed to load items:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [setUnreadInboxCount]);

  useFocusEffect(
    useCallback(() => {
      loadItems();
    }, [loadItems])
  );

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadItems();
  };

  const handleMoveItem = async (folderId: string | null) => {
    if (!selectedItem) return;
    try {
      await apiService.moveItemToFolder(selectedItem.id, folderId);
      setShowMoveModal(false);
      setSelectedItem(null);
      loadItems();
    } catch (error) {
      console.error('Failed to move item:', error);
    }
  };

  const processingItems = items.filter((item) => isLoadingStatus(item.status));
  const needsReviewItems = items.filter((item) => item.status === 'needs_review');
  const recentlyFiledItems = items
    .filter((item) => item.status === 'ready' && item.folderId)
    .slice(0, 10);

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="small" color={colors.text} />
      </View>
    );
  }

  if (items.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Inbox</Text>
        </View>
        <Animated.View
          entering={FadeIn.duration(300)}
          style={styles.emptyContainer}
        >
          <View style={[styles.emptyIconWrapper, { backgroundColor: colors.accentSubtle }]}>
            <Ionicons name="file-tray-outline" size={32} color={colors.textTertiary} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            Inbox is empty
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.textTertiary }]}>
            Share a TikTok video to get started.{'\n'}It will appear here for processing.
          </Text>
        </Animated.View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Inbox</Text>
        {needsReviewItems.length > 0 && (
          <View style={[styles.badge, { backgroundColor: colors.warning }]}>
            <Text style={styles.badgeText}>{needsReviewItems.length}</Text>
          </View>
        )}
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.text}
          />
        }
      >
        {/* Processing Section */}
        {processingItems.length > 0 && (
          <AnimatedListItem index={0} direction="fade">
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>
                PROCESSING
              </Text>
              {processingItems.map((item, index) => (
                <View
                  key={item.id}
                  style={[styles.itemRow, { borderBottomColor: colors.border }]}
                >
                  <View style={[styles.thumbnailPlaceholder, { backgroundColor: colors.accentSubtle }]}>
                    <ActivityIndicator size="small" color={colors.text} />
                  </View>
                  <View style={styles.itemContent}>
                    <Text style={[styles.itemTitle, { color: colors.text }]} numberOfLines={1}>
                      {getDisplayTitle(item)}
                    </Text>
                    <Text style={[styles.statusText, { color: colors.textTertiary }]}>
                      {item.status.replace('_', ' ')}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </AnimatedListItem>
        )}

        {/* Needs Review Section */}
        {needsReviewItems.length > 0 && (
          <AnimatedListItem index={1} direction="fade">
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: colors.warning }]}>
                NEEDS REVIEW
              </Text>
              {needsReviewItems.map((item) => (
                <AnimatedPressable
                  key={item.id}
                  style={[styles.itemRow, { borderBottomColor: colors.border }]}
                  onPress={() => {
                    setSelectedItem(item);
                    setShowMoveModal(true);
                  }}
                >
                  <View style={[styles.thumbnailPlaceholder, { backgroundColor: colors.warningSubtle }]}>
                    <Ionicons name="alert-circle" size={18} color={colors.warning} />
                  </View>
                  <View style={styles.itemContent}>
                    <Text style={[styles.itemTitle, { color: colors.text }]} numberOfLines={2}>
                      {getDisplayTitle(item)}
                    </Text>
                    {item.folderName && (
                      <Text style={[styles.suggestedText, { color: colors.warning }]}>
                        Suggested: {item.folderName}
                      </Text>
                    )}
                    {item.detectedTopics.length > 0 && (
                      <View style={styles.topicsRow}>
                        {item.detectedTopics.slice(0, 2).map((topic) => (
                          <Text
                            key={topic}
                            style={[styles.topicText, { color: colors.textQuaternary }]}
                          >
                            {topic}
                          </Text>
                        ))}
                      </View>
                    )}
                  </View>
                  <Ionicons name="chevron-forward" size={14} color={colors.textQuaternary} />
                </AnimatedPressable>
              ))}
            </View>
          </AnimatedListItem>
        )}

        {/* Recently Filed Section */}
        {recentlyFiledItems.length > 0 && (
          <AnimatedListItem index={2} direction="fade">
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>
                RECENTLY FILED
              </Text>
              {recentlyFiledItems.map((item) => (
                <AnimatedPressable
                  key={item.id}
                  style={[styles.itemRow, { borderBottomColor: colors.border }]}
                  onPress={() => navigation.navigate('VideoDetail', { item })}
                >
                  <View style={[styles.thumbnailSmall, { backgroundColor: colors.successSubtle }]}>
                    <Ionicons name="checkmark" size={14} color={colors.success} />
                  </View>
                  <View style={styles.itemContent}>
                    <Text style={[styles.itemTitle, { color: colors.text }]} numberOfLines={1}>
                      {getDisplayTitle(item)}
                    </Text>
                    {item.folderName && (
                      <Text style={[styles.folderText, { color: colors.textTertiary }]}>
                        {item.folderName}
                      </Text>
                    )}
                  </View>
                  <Text style={[styles.timeAgo, { color: colors.textQuaternary }]}>
                    {formatTimeAgo(item.dateAdded)}
                  </Text>
                </AnimatedPressable>
              ))}
            </View>
          </AnimatedListItem>
        )}
      </ScrollView>

      <MoveFolderModal
        visible={showMoveModal}
        item={selectedItem}
        onClose={() => {
          setShowMoveModal(false);
          setSelectedItem(null);
        }}
        onMove={handleMoveItem}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
  },
  headerTitle: {
    ...Typography.displayMd,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#ffffff',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: Spacing.xl,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  emptyIconWrapper: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  emptyTitle: {
    ...Typography.heading,
    marginBottom: Spacing.xs,
  },
  emptySubtitle: {
    ...Typography.body,
    textAlign: 'center',
  },
  section: {
    marginBottom: Spacing.lg,
  },
  sectionLabel: {
    ...Typography.label,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: Hairline,
  },
  thumbnailPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbnailSmall: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemContent: {
    flex: 1,
    gap: 2,
  },
  itemTitle: {
    ...Typography.captionStrong,
  },
  statusText: {
    ...Typography.caption,
    textTransform: 'capitalize',
  },
  suggestedText: {
    fontSize: 12,
  },
  topicsRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    marginTop: 2,
  },
  topicText: {
    fontSize: 11,
  },
  folderText: {
    fontSize: 12,
  },
  timeAgo: {
    fontSize: 11,
  },
});
