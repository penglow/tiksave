import React, { useState, useCallback, useLayoutEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Linking,
  Alert,
  Platform,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

import { Colors, Spacing, BorderRadius } from '../config';
import { SaveItem, getDisplayTitle, needsUserReview } from '../types';
import { apiService } from '../services/api';
import { LibraryStackScreenProps } from '../navigation/types';
import MoveFolderModal from '../components/MoveFolderModal';
import { formatDuration } from '../utils/date';

const { width } = Dimensions.get('window');
const COLUMN_GAP = 12;
const PADDING = 16;
const CARD_WIDTH = (width - PADDING * 2 - COLUMN_GAP) / 2;

type Props = LibraryStackScreenProps<'FolderDetail'>;

export default function FolderDetailScreen({ route, navigation }: Props) {
  const { folder } = route.params;
  const [isDeleting, setIsDeleting] = useState(false);
  const [items, setItems] = useState<SaveItem[]>([]);

  const performDelete = async () => {
    setIsDeleting(true);
    try {
      await apiService.deleteFolder(folder.id);
      navigation.goBack();
    } catch (error) {
      console.error('Failed to delete folder:', error);
      if (Platform.OS === 'web') {
        window.alert('Failed to delete folder. Please try again.');
      } else {
        Alert.alert('Error', 'Failed to delete folder. Please try again.');
      }
      setIsDeleting(false);
    }
  };

  const handleDeleteFolder = useCallback(() => {
    const message = `Delete "${folder.name}" and all ${items.length} video${items.length !== 1 ? 's' : ''} inside? This cannot be undone.`;
    
    if (Platform.OS === 'web') {
      const confirmed = window.confirm(message);
      if (confirmed) {
        performDelete();
      }
    } else {
      Alert.alert('Delete Folder', message, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: performDelete },
      ]);
    }
  }, [folder.id, folder.name, items.length, navigation]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={handleDeleteFolder}
          disabled={isDeleting}
          style={styles.headerButton}
        >
          <Ionicons
            name="trash-outline"
            size={22}
            color={isDeleting ? Colors.textQuaternary : Colors.error}
          />
        </TouchableOpacity>
      ),
    });
  }, [navigation, handleDeleteFolder, isDeleting]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedItem, setSelectedItem] = useState<SaveItem | null>(null);
  const [showMoveModal, setShowMoveModal] = useState(false);

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

  const handleDeleteItem = async (item: SaveItem) => {
    try {
      await apiService.deleteItem(item.id);
      loadItems();
    } catch (error) {
      console.error('Failed to delete item:', error);
    }
  };

  const openInTikTok = (url: string) => {
    Linking.openURL(url);
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (items.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="folder-outline" size={60} color={Colors.textQuaternary} />
        <Text style={styles.emptyTitle}>No videos in {folder.name}</Text>
        <Text style={styles.emptySubtitle}>
          Videos will appear here when{'\n'}they're filed into this folder
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
        <View style={styles.grid}>
          {items.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.card}
              onPress={() => navigation.navigate('VideoDetail', { item })}
              onLongPress={() => {
                setSelectedItem(item);
                setShowMoveModal(true);
              }}
              activeOpacity={0.8}
            >
              <VideoThumbnailCard
                item={item}
                onOpenTikTok={() => openInTikTok(item.sourceURL)}
              />
            </TouchableOpacity>
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
  const showsNeedsReview = needsUserReview(item);

  return (
    <View style={styles.cardContent}>
      {/* Thumbnail */}
      <View style={styles.thumbnailContainer}>
        {item.thumbnailURL ? (
          <Image
            source={{
              uri: item.thumbnailURL,
              cache: 'force-cache',
            }}
            style={styles.thumbnail}
            resizeMode="cover"
            onError={() => {
              console.warn('Failed to load thumbnail:', item.thumbnailURL?.substring(0, 80));
            }}
          />
        ) : (
          <LinearGradient
            colors={[`${Colors.secondary}4D`, `${Colors.primary}4D`]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.thumbnail}
          >
            <Ionicons name="play" size={32} color="rgba(255, 255, 255, 0.8)" />
          </LinearGradient>
        )}

        {/* Play overlay */}
        <View style={styles.playOverlay} pointerEvents="none">
          <Ionicons name="play-circle" size={40} color="rgba(255, 255, 255, 0.9)" />
        </View>

        {/* Duration badge */}
        {item.duration && (
          <View style={styles.durationBadge}>
            <Text style={styles.durationText}>{formatDuration(item.duration)}</Text>
          </View>
        )}

        {/* Needs review indicator */}
        {showsNeedsReview && (
          <View style={styles.reviewBadge}>
            <Ionicons name="alert-circle" size={14} color={Colors.warning} />
          </View>
        )}
      </View>

      {/* Info */}
      <Text style={styles.cardTitle} numberOfLines={2}>
        {getDisplayTitle(item)}
      </Text>

      {item.creatorUsername && (
        <Text style={styles.creatorName} numberOfLines={1}>
          {item.creatorUsername}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  headerButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
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
    backgroundColor: Colors.background,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.xxl,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textTertiary,
    marginTop: Spacing.xl,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.textQuaternary,
    textAlign: 'center',
    marginTop: Spacing.sm,
    lineHeight: 20,
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
    backgroundColor: Colors.overlayLight,
    borderRadius: BorderRadius.lg,
    padding: Spacing.sm,
  },
  thumbnailContainer: {
    position: 'relative',
    marginBottom: Spacing.sm,
  },
  thumbnail: {
    aspectRatio: 9 / 16,
    borderRadius: BorderRadius.md,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.overlay,
  },
  playOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: BorderRadius.md,
  },
  durationBadge: {
    position: 'absolute',
    bottom: Spacing.sm,
    right: Spacing.sm,
    backgroundColor: Colors.overlayDark,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  durationText: {
    color: Colors.text,
    fontSize: 11,
    fontWeight: '600',
  },
  reviewBadge: {
    position: 'absolute',
    top: Spacing.sm,
    left: Spacing.sm,
    backgroundColor: Colors.overlayDark,
    padding: 4,
    borderRadius: 12,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.text,
    marginBottom: 2,
  },
  creatorName: {
    fontSize: 11,
    color: Colors.textTertiary,
  },
});

