import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

import { Colors, Spacing, BorderRadius } from '../config';
import { SaveItem, getDisplayTitle, isLoadingStatus } from '../types';
import { apiService } from '../services/api';
import { useAppStore } from '../stores/appStore';
import { InboxStackScreenProps } from '../navigation/types';
import MoveFolderModal from '../components/MoveFolderModal';
import { formatTimeAgo } from '../utils/date';

type Props = InboxStackScreenProps<'InboxMain'>;

export default function InboxScreen({ navigation }: Props) {
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

      // Update inbox count
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
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (items.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIconContainer}>
          <Ionicons name="file-tray" size={50} color={Colors.primary} />
        </View>
        <Text style={styles.emptyTitle}>Your inbox is empty</Text>
        <Text style={styles.emptySubtitle}>
          Share a TikTok video to get started.{'\n'}It will appear here for processing.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.primary}
          />
        }
      >
        {/* Processing Section */}
        {processingItems.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="cog" size={18} color={Colors.primary} />
              <Text style={styles.sectionTitle}>Processing</Text>
              <Text style={styles.sectionCount}>{processingItems.length}</Text>
            </View>
            {processingItems.map((item) => (
              <ProcessingItemRow key={item.id} item={item} />
            ))}
          </View>
        )}

        {/* Needs Review Section */}
        {needsReviewItems.length > 0 && (
          <View style={[styles.section, styles.reviewSection]}>
            <View style={styles.sectionHeader}>
              <Ionicons name="alert-circle" size={18} color={Colors.warning} />
              <Text style={styles.sectionTitle}>Needs Review</Text>
              <Text style={styles.sectionCount}>{needsReviewItems.length}</Text>
            </View>
            {needsReviewItems.map((item) => (
              <TouchableOpacity
                key={item.id}
                onPress={() => {
                  setSelectedItem(item);
                  setShowMoveModal(true);
                }}
                activeOpacity={0.7}
              >
                <NeedsReviewItemRow item={item} />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Recently Filed Section */}
        {recentlyFiledItems.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
              <Text style={styles.sectionTitle}>Recently Filed</Text>
            </View>
            {recentlyFiledItems.map((item) => (
              <TouchableOpacity
                key={item.id}
                onPress={() => navigation.navigate('VideoDetail', { item })}
                activeOpacity={0.7}
              >
                <RecentlyFiledItemRow item={item} />
              </TouchableOpacity>
            ))}
          </View>
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

// Processing Item Row
function ProcessingItemRow({ item }: { item: SaveItem }) {
  return (
    <View style={styles.itemRow}>
      <View style={styles.thumbnailPlaceholder}>
        <ActivityIndicator size="small" color={Colors.primary} />
      </View>
      <View style={styles.itemContent}>
        <Text style={styles.itemTitle} numberOfLines={1}>
          {getDisplayTitle(item)}
        </Text>
        <Text style={styles.statusText}>{item.status.replace('_', ' ')}</Text>
      </View>
    </View>
  );
}

// Needs Review Item Row
function NeedsReviewItemRow({ item }: { item: SaveItem }) {
  return (
    <View style={styles.itemRow}>
      <View style={styles.thumbnailPlaceholder}>
        <Ionicons name="play" size={20} color={Colors.textTertiary} />
      </View>
      <View style={styles.itemContent}>
        <Text style={styles.itemTitle} numberOfLines={2}>
          {getDisplayTitle(item)}
        </Text>
        {item.folderName && (
          <View style={styles.suggestedFolder}>
            <Ionicons name="folder" size={12} color={Colors.warning} />
            <Text style={styles.suggestedFolderText}>Suggested: {item.folderName}</Text>
          </View>
        )}
        <View style={styles.topicsRow}>
          {item.detectedTopics.slice(0, 2).map((topic) => (
            <View key={topic} style={styles.topicBadge}>
              <Text style={styles.topicText}>{topic}</Text>
            </View>
          ))}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={16} color={Colors.textQuaternary} />
    </View>
  );
}

// Recently Filed Item Row
function RecentlyFiledItemRow({ item }: { item: SaveItem }) {
  return (
    <View style={styles.itemRow}>
      <View style={styles.thumbnailSmall}>
        <Ionicons name="play" size={16} color={Colors.textTertiary} />
      </View>
      <View style={styles.itemContent}>
        <Text style={styles.itemTitle} numberOfLines={1}>
          {getDisplayTitle(item)}
        </Text>
        {item.folderName && (
          <View style={styles.folderRow}>
            <Ionicons name="folder" size={12} color={Colors.success} />
            <Text style={styles.folderText}>{item.folderName}</Text>
          </View>
        )}
      </View>
      <Text style={styles.timeAgo}>{formatTimeAgo(item.dateAdded)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  loadingText: {
    marginTop: Spacing.lg,
    color: Colors.textTertiary,
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.xxl,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(6, 182, 212, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.xxl,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  emptySubtitle: {
    fontSize: 15,
    color: Colors.textTertiary,
    textAlign: 'center',
    lineHeight: 22,
  },
  section: {
    backgroundColor: Colors.overlayLight,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  reviewSection: {
    backgroundColor: 'rgba(249, 115, 22, 0.1)',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    flex: 1,
  },
  sectionCount: {
    fontSize: 14,
    color: Colors.textTertiary,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  thumbnailPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbnailSmall: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemContent: {
    flex: 1,
    gap: Spacing.xs,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
  },
  statusText: {
    fontSize: 12,
    color: Colors.primary,
    textTransform: 'capitalize',
  },
  suggestedFolder: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  suggestedFolderText: {
    fontSize: 12,
    color: Colors.warning,
  },
  topicsRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    flexWrap: 'wrap',
  },
  topicBadge: {
    backgroundColor: Colors.overlay,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  topicText: {
    fontSize: 11,
    color: Colors.textSecondary,
  },
  folderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  folderText: {
    fontSize: 12,
    color: Colors.success,
  },
  timeAgo: {
    fontSize: 12,
    color: Colors.textQuaternary,
  },
});

