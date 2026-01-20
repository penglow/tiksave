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
import Animated, { FadeIn } from 'react-native-reanimated';

import { Spacing, BorderRadius, Typography, Hairline } from '../config';
import { SaveItem, getDisplayTitle, needsUserReview } from '../types';
import { apiService } from '../services/api';
import { LibraryStackScreenProps } from '../navigation/types';
import { useTheme } from '../hooks/useTheme';
import { AnimatedPressable, AnimatedListItem, AnimatedText } from '../components';
import MoveFolderModal from '../components/MoveFolderModal';
import { formatDuration } from '../utils/date';

const { width } = Dimensions.get('window');
const COLUMN_GAP = 8;
const PADDING = 16;
const CARD_WIDTH = (width - PADDING * 2 - COLUMN_GAP) / 2;

type Props = LibraryStackScreenProps<'FolderDetail'>;

export default function FolderDetailScreen({ route, navigation }: Props) {
  const { folder } = route.params;
  const { colors } = useTheme();
  const [isDeleting, setIsDeleting] = useState(false);
  const [items, setItems] = useState<SaveItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedItem, setSelectedItem] = useState<SaveItem | null>(null);
  const [showMoveModal, setShowMoveModal] = useState(false);

  const performDelete = async () => {
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
  };

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
  }, [folder.id, folder.name, navigation]);

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

  const openInTikTok = (url: string) => {
    Linking.openURL(url);
  };

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="small" color={colors.text} />
      </View>
    );
  }

  if (items.length === 0) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: colors.background }]}>
        <View style={[styles.emptyIconWrapper, { backgroundColor: colors.accentSubtle }]}>
          <Ionicons name="folder-open-outline" size={32} color={colors.textTertiary} />
        </View>
        <AnimatedText delay={100} style={[styles.emptyTitle, { color: colors.text }]}>
          No videos in {folder.name}
        </AnimatedText>
        <AnimatedText delay={200} style={[styles.emptySubtitle, { color: colors.textTertiary }]}>
          Videos will appear here when{'\n'}they're filed into this folder
        </AnimatedText>
      </View>
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
                onPress={() => navigation.navigate('VideoDetail', { item })}
                onLongPress={() => {
                  setSelectedItem(item);
                  setShowMoveModal(true);
                }}
                scaleOnPress={0.98}
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
        onClose={() => {
          setShowMoveModal(false);
          setSelectedItem(null);
        }}
        onMove={handleMoveItem}
      />
    </View>
  );
}

function VideoThumbnailCard({
  item,
  onOpenTikTok,
}: {
  item: SaveItem;
  onOpenTikTok: () => void;
}) {
  const { colors } = useTheme();
  const showsNeedsReview = needsUserReview(item);

  return (
    <View style={styles.cardContent}>
      {/* Thumbnail */}
      <View style={styles.thumbnailContainer}>
        {item.thumbnailURL ? (
          <Image
            source={{ uri: item.thumbnailURL, cache: 'force-cache' }}
            style={styles.thumbnail}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.thumbnail, styles.thumbnailPlaceholder, { backgroundColor: colors.accentSubtle }]}>
            <Ionicons name="play" size={24} color={colors.textTertiary} />
          </View>
        )}

        {/* Duration badge */}
        {item.duration && (
          <View style={styles.durationBadge}>
            <Text style={styles.durationText}>{formatDuration(item.duration)}</Text>
          </View>
        )}

        {/* Needs review indicator */}
        {showsNeedsReview && (
          <View style={[styles.reviewBadge, { backgroundColor: colors.warningSubtle }]}>
            <Ionicons name="alert-circle" size={12} color={colors.warning} />
          </View>
        )}
      </View>

      {/* Info */}
      <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={2}>
        {getDisplayTitle(item)}
      </Text>

      {item.creatorUsername && (
        <Text style={[styles.creatorName, { color: colors.textTertiary }]} numberOfLines={1}>
          @{item.creatorUsername}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: PADDING,
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
    marginBottom: Spacing.xs,
  },
  thumbnail: {
    aspectRatio: 9 / 16,
    borderRadius: BorderRadius.none,
    width: '100%',
  },
  thumbnailPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  durationBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
  },
  durationText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '500',
  },
  reviewBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    padding: 4,
    borderRadius: 10,
  },
  cardTitle: {
    ...Typography.captionStrong,
    lineHeight: 16,
  },
  creatorName: {
    fontSize: 11,
    marginTop: 2,
  },
});
