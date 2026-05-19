/**
 * FolderDetailScreen
 *
 * Shows all saved videos assigned to a single user folder. Supports pull-to-refresh,
 * navigation to video detail on tap, move-to-folder via long-press, and folder deletion
 * from the stack header.
 */

import React, { useState, useCallback, useLayoutEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
  Linking,
  Alert,
  Platform,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

import { Spacing, BorderRadius, Typography, Shadows } from '../config';
import { SaveItem, getDisplayTitle, needsUserReview } from '../types';
import { apiService } from '../services/api';
import { LibraryStackScreenProps } from '../navigation/types';
import { useTheme } from '../hooks/useTheme';
import { useResolvedTikTokThumbnail } from '../hooks/useResolvedTikTokThumbnail';
import { AnimatedPressable, AnimatedListItem, AnimatedText } from '../components';
import MoveFolderModal from '../components/MoveFolderModal';
import { formatDuration } from '../utils/date';

// -----------------------------------------------------------------------------
// Layout constants — two-column grid sized from screen width
// -----------------------------------------------------------------------------

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const COLUMN_GAP = 12;
const HORIZONTAL_PADDING = 16;
const CARD_WIDTH =
  (SCREEN_WIDTH - HORIZONTAL_PADDING * 2 - COLUMN_GAP) / 2;

type Props = LibraryStackScreenProps<'FolderDetail'>;

// -----------------------------------------------------------------------------
// Main screen
// -----------------------------------------------------------------------------

export default function FolderDetailScreen({ route, navigation }: Props) {
  const { folder } = route.params;
  const { colors } = useTheme();

  // --- List & UI state --------------------------------------------------------

  const [items, setItems] = useState<SaveItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Move modal: which item is being relocated (set on long-press)
  const [selectedItem, setSelectedItem] = useState<SaveItem | null>(null);
  const [showMoveModal, setShowMoveModal] = useState(false);

  // --- Data loading -----------------------------------------------------------

  const loadItems = useCallback(async () => {
    try {
      const data = await apiService.getItems({ folderId: folder.id });
      setItems(data);
    } catch (error) {
      console.error('Failed to load items:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [folder.id]);

  /** Refetch whenever this screen gains focus (e.g. after moving an item elsewhere). */
  useFocusEffect(
    useCallback(() => {
      loadItems();
    }, [loadItems])
  );

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    loadItems();
  }, [loadItems]);

  // --- Folder deletion (header trash action) ----------------------------------

  const performDelete = useCallback(async () => {
    setIsDeleting(true);
    try {
      await apiService.deleteFolder(folder.id);
      navigation.goBack();
    } catch (error) {
      console.error('Failed to delete folder:', error);
      if (Platform.OS === 'web') {
        window.alert('Failed to delete folder.');
      } else {
        Alert.alert('Error', 'Failed to delete folder.');
      }
      setIsDeleting(false);
    }
  }, [folder.id, navigation]);

  const handleDeleteFolder = useCallback(() => {
    const message = `Delete "${folder.name}"?`;

    if (Platform.OS === 'web') {
      if (window.confirm(message)) {
        performDelete();
      }
    } else {
      Alert.alert('Delete Folder', message, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: performDelete },
      ]);
    }
  }, [folder.name, performDelete]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <AnimatedPressable
          onPress={handleDeleteFolder}
          disabled={isDeleting}
          style={styles.headerButton}
        >
          <Ionicons
            name="trash-outline"
            size={20}
            color={isDeleting ? colors.textQuaternary : colors.error}
          />
        </AnimatedPressable>
      ),
    });
  }, [navigation, handleDeleteFolder, isDeleting, colors]);

  // --- Item actions -----------------------------------------------------------

  const handleMoveItem = useCallback(
    async (folderId: string | null) => {
      if (!selectedItem) return;
      try {
        await apiService.moveItemToFolder(selectedItem.id, folderId);
        setShowMoveModal(false);
        setSelectedItem(null);
        loadItems();
      } catch (error) {
        console.error('Failed to move item:', error);
      }
    },
    [selectedItem, loadItems]
  );

  const openMoveModalForItem = useCallback((item: SaveItem) => {
    setSelectedItem(item);
    setShowMoveModal(true);
  }, []);

  const closeMoveModal = useCallback(() => {
    setShowMoveModal(false);
    setSelectedItem(null);
  }, []);

  const openInTikTok = useCallback((url: string) => {
    Linking.openURL(url);
  }, []);

  const navigateToVideoDetail = useCallback(
    (item: SaveItem) => {
      navigation.navigate('VideoDetail', { item });
    },
    [navigation]
  );

  // --- Render -----------------------------------------------------------------

  if (isLoading) {
    return <FolderLoadingView backgroundColor={colors.background} />;
  }

  if (items.length === 0) {
    return (
      <FolderEmptyView
        folderName={folder.name}
        backgroundColor={colors.background}
        accentColor={colors.accent}
        accentSubtleColor={colors.accentSubtle}
        textColor={colors.text}
        subtitleColor={colors.textTertiary}
      />
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
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
        <View style={styles.grid}>
          {items.map((item, index) => (
            <AnimatedListItem key={item.id} index={index} direction="fade">
              <AnimatedPressable
                style={styles.card}
                onPress={() => navigateToVideoDetail(item)}
                onLongPress={() => openMoveModalForItem(item)}
                scaleOnPress={0.97}
              >
                <VideoThumbnailCard
                  item={item}
                  onOpenTikTok={() => openInTikTok(item.sourceURL)}
                />
              </AnimatedPressable>
            </AnimatedListItem>
          ))}
        </View>
      </ScrollView>

      <MoveFolderModal
        visible={showMoveModal}
        item={selectedItem}
        onClose={closeMoveModal}
        onMove={handleMoveItem}
      />
    </View>
  );
}

// -----------------------------------------------------------------------------
// Presentational subviews (loading / empty)
// -----------------------------------------------------------------------------

/** Centered spinner shown on first load before items are known. */
function FolderLoadingView({ backgroundColor }: { backgroundColor: string }) {
  const { colors } = useTheme();

  return (
    <View style={[styles.loadingContainer, { backgroundColor }]}>
      <ActivityIndicator size="small" color={colors.text} />
    </View>
  );
}

/** Shown when the folder exists but has no assigned videos yet. */
function FolderEmptyView({
  folderName,
  backgroundColor,
  accentColor,
  accentSubtleColor,
  textColor,
  subtitleColor,
}: {
  folderName: string;
  backgroundColor: string;
  accentColor: string;
  accentSubtleColor: string;
  textColor: string;
  subtitleColor: string;
}) {
  return (
    <View style={[styles.emptyContainer, { backgroundColor }]}>
      <View style={[styles.emptyIconWrapper, { backgroundColor: accentSubtleColor }]}>
        <Ionicons name="folder-open-outline" size={32} color={accentColor} />
      </View>
      <AnimatedText delay={100} style={[styles.emptyTitle, { color: textColor }]}>
        No videos in {folderName}
      </AnimatedText>
      <AnimatedText delay={200} style={[styles.emptySubtitle, { color: subtitleColor }]}>
        Videos will appear here when{'\n'}they're filed into this folder
      </AnimatedText>
    </View>
  );
}

// -----------------------------------------------------------------------------
// Grid card — thumbnail, metadata, and status overlays
// -----------------------------------------------------------------------------

type VideoThumbnailCardProps = {
  item: SaveItem;
  /** Reserved for future quick-open affordance; parent passes TikTok URL handler. */
  onOpenTikTok: () => void;
};

function VideoThumbnailCard({ item, onOpenTikTok: _onOpenTikTok }: VideoThumbnailCardProps) {
  const { colors } = useTheme();
  const showsNeedsReview = needsUserReview(item);
  const thumbUri = useResolvedTikTokThumbnail(item.sourceURL, item.thumbnailURL);

  return (
    <View style={styles.cardContent}>
      {/* 9:16 preview — resolved via oEmbed when stored thumbnail is missing */}
      <View style={styles.thumbnailContainer}>
        {thumbUri ? (
          <Image
            source={{ uri: thumbUri, cache: 'force-cache' }}
            style={styles.thumbnail}
            resizeMode="cover"
          />
        ) : (
          <View
            style={[
              styles.thumbnail,
              styles.thumbnailPlaceholder,
              { backgroundColor: colors.surfaceHover },
            ]}
          >
            <Ionicons name="play" size={24} color={colors.textTertiary} />
          </View>
        )}

        {/* Bottom-right overlay when indexer provided a duration */}
        {item.duration ? (
          <View style={styles.durationBadge}>
            <Text style={styles.durationText}>{formatDuration(item.duration)}</Text>
          </View>
        ) : null}

        {/* Top-left warning when metadata still needs user confirmation */}
        {showsNeedsReview && (
          <View style={[styles.reviewBadge, { backgroundColor: colors.warningSubtle }]}>
            <Ionicons name="alert-circle" size={12} color={colors.warning} />
          </View>
        )}
      </View>

      {/* Title falls back to URL or placeholder via getDisplayTitle */}
      <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={2}>
        {getDisplayTitle(item)}
      </Text>

      {item.creatorUsername ? (
        <Text style={[styles.creatorName, { color: colors.textTertiary }]} numberOfLines={1}>
          @{item.creatorUsername}
        </Text>
      ) : null}
    </View>
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
  headerButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  scrollView: {
    flex: 1,
    minHeight: 0,
  },
  scrollContent: {
    padding: HORIZONTAL_PADDING,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  emptyIconWrapper: {
    width: 72,
    height: 72,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  emptyTitle: {
    ...Typography.heading,
    marginBottom: Spacing.xs,
    textAlign: 'center',
  },
  emptySubtitle: {
    ...Typography.body,
    textAlign: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: COLUMN_GAP,
  },
  card: {
    width: CARD_WIDTH,
  },
  cardContent: {
    marginBottom: Spacing.md,
  },
  thumbnailContainer: {
    position: 'relative',
    marginBottom: Spacing.sm,
  },
  thumbnail: {
    aspectRatio: 9 / 16,
    borderRadius: BorderRadius.md,
    width: '100%',
    backgroundColor: '#000',
    ...Shadows.sm,
    borderWidth: 1,
    borderColor: 'rgba(128, 128, 128, 0.12)',
  },
  thumbnailPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  durationBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
  },
  durationText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '600',
  },
  reviewBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    padding: 4,
    borderRadius: 10,
  },
  cardTitle: {
    ...Typography.captionStrong,
    lineHeight: 17,
  },
  creatorName: {
    fontSize: 12,
    marginTop: 2,
  },
});
