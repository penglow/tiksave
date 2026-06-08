/**
 * CategoryDetailScreen
 *
 * Lists videos grouped by AI-detected topic within the Library stack. Route params
 * supply `categoryName`, optional `subcategoryName`, and accent `color`. Pushes nested
 * subcategory routes or `VideoDetail` on row tap.
 */

import React, { useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Image,
  Linking,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Spacing, BorderRadius, Typography, Hairline, Shadows, TAB_BAR_OVERLAP } from '../config';
import { SaveItem, getDisplayTitle } from '../types';
import {
  itemBelongsToLibraryCategory,
  itemHasSubcategoryTopic,
  parseDetectedTopic,
} from '../utils/libraryTopicFilter';
import { fetchAllLibraryItems } from '../utils/fetchAllLibraryItems';
import { LibraryStackScreenProps } from '../navigation/types';
import { formatTimeAgo } from '../utils/date';
import { useTheme } from '../hooks/useTheme';
import { useResolvedTikTokThumbnail } from '../hooks/useResolvedTikTokThumbnail';
import { AnimatedListItem, AnimatedPressable, AnimatedText } from '../components';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type Props = LibraryStackScreenProps<'CategoryDetail'>;

interface Subcategory {
  name: string;
  items: SaveItem[];
}

// -----------------------------------------------------------------------------
// Main screen
// -----------------------------------------------------------------------------

export default function CategoryDetailScreen({ route, navigation }: Props) {
  const { categoryName, color, subcategoryName } = route.params;
  const { colors } = useTheme();

  // --- List state -------------------------------------------------------------

  const [items, setItems] = useState<SaveItem[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // --- Data loading -----------------------------------------------------------

  const loadItems = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const allItems = await fetchAllLibraryItems(controller.signal);
      if (controller.signal.aborted) return;

      const categoryItems = allItems.filter((item) =>
        itemBelongsToLibraryCategory(item, categoryName, subcategoryName),
      );

      if (subcategoryName) {
        setItems(
          categoryItems.sort(
            (a, b) => new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime(),
          ),
        );
      } else {
        const subcategoryMap = new Map<string, SaveItem[]>();

        for (const item of categoryItems) {
          const primaryTopic = item.detectedTopics?.[0] || 'Saved';
          const { subName } = parseDetectedTopic(primaryTopic);

          if (subName) {
            if (!subcategoryMap.has(subName)) {
              subcategoryMap.set(subName, []);
            }
            subcategoryMap.get(subName)!.push(item);
          }
        }

        const subcategoriesList: Subcategory[] = [];
        for (const [name, subItems] of subcategoryMap) {
          subcategoriesList.push({
            name,
            items: subItems.sort(
              (a, b) => new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime(),
            ),
          });
        }

        setSubcategories(subcategoriesList.sort((a, b) => b.items.length - a.items.length));
        setItems(categoryItems);
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      console.error('Failed to load items:', error);
    } finally {
      if (!controller.signal.aborted) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [categoryName, subcategoryName]);

  /** Videos filed directly under the parent topic (not in a subcategory row). */
  const directItems = useMemo(() => {
    if (subcategoryName) return [];
    return items.filter((item) => !itemHasSubcategoryTopic(item));
  }, [items, subcategoryName]);

  useFocusEffect(
    useCallback(() => {
      loadItems();
    }, [loadItems]),
  );

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    loadItems();
  }, [loadItems]);

  const navigateToVideoDetail = useCallback(
    (item: SaveItem) => {
      navigation.navigate('VideoDetail', { item });
    },
    [navigation],
  );

  const navigateToSubcategory = useCallback(
    (name: string) => {
      navigation.navigate('CategoryDetail', {
        categoryName,
        icon: '',
        color,
        subcategoryName: name,
      });
    },
    [navigation, categoryName, color],
  );

  const renderVideoItem = useCallback(
    ({ item, index }: { item: SaveItem; index: number }) => (
      <AnimatedListItem index={index} direction="fade">
        <VideoRow item={item} onPress={() => navigateToVideoDetail(item)} />
      </AnimatedListItem>
    ),
    [navigateToVideoDetail],
  );

  const renderSubcategoryItem = useCallback(
    ({ item: subcategory, index }: { item: Subcategory; index: number }) => (
      <AnimatedListItem index={index} direction="fade">
        <SubcategoryRow
          subcategory={subcategory}
          borderColor={colors.border}
          textColor={colors.text}
          subtitleColor={colors.textTertiary}
          chevronColor={colors.textQuaternary}
          onPress={() => navigateToSubcategory(subcategory.name)}
        />
      </AnimatedListItem>
    ),
    [colors, navigateToSubcategory],
  );

  // --- Render -----------------------------------------------------------------

  if (isLoading) {
    return <CategoryLoadingView backgroundColor={colors.background} />;
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <Animated.View entering={FadeIn.duration(300)} style={styles.header}>
        <View style={styles.headerTitleRow}>
          <View style={[styles.categoryDot, { backgroundColor: color }]} />
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            {subcategoryName || categoryName}
          </Text>
        </View>
        <Text style={[styles.headerSubtitle, { color: colors.textTertiary }]}>
          {subcategoryName
            ? `${items.length} video${items.length !== 1 ? 's' : ''}`
            : `${items.length} video${items.length !== 1 ? 's' : ''} · ${subcategories.length} subcategories`}
        </Text>
      </Animated.View>

      {subcategoryName ? (
        <FlatList
          data={items}
          renderItem={renderVideoItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          style={styles.listFlat}
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
          removeClippedSubviews={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={colors.text}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={[styles.emptyIconWrapper, { backgroundColor: colors.surfaceHover }]}>
                <Ionicons name="grid-outline" size={28} color={colors.textTertiary} />
              </View>
              <AnimatedText delay={100} style={[styles.emptyText, { color: colors.textTertiary }]}>
                No videos in this category
              </AnimatedText>
            </View>
          }
        />
      ) : subcategories.length > 0 ? (
        <FlatList
          data={subcategories}
          renderItem={renderSubcategoryItem}
          keyExtractor={(item) => item.name}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          style={styles.listFlat}
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
          removeClippedSubviews={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={colors.text}
            />
          }
          ListHeaderComponent={
            <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>SUBCATEGORIES</Text>
          }
          ListFooterComponent={
            directItems.length > 0 ? (
              <View style={styles.allVideosSection}>
                <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>
                  IN THIS CATEGORY
                </Text>
                {directItems.map((item, index) => (
                  <AnimatedListItem key={item.id} index={index} direction="fade">
                    <VideoRow item={item} onPress={() => navigateToVideoDetail(item)} />
                  </AnimatedListItem>
                ))}
              </View>
            ) : null
          }
          ListEmptyComponent={
            items.length === 0 ? (
              <CategoryEmptyView
                surfaceHoverColor={colors.surfaceHover}
                subtitleColor={colors.textTertiary}
              />
            ) : null
          }
        />
      ) : (
        <FlatList
          data={items}
          renderItem={renderVideoItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          style={styles.listFlat}
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
          removeClippedSubviews={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={colors.text}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={[styles.emptyIconWrapper, { backgroundColor: colors.surfaceHover }]}>
                <Ionicons name="grid-outline" size={28} color={colors.textTertiary} />
              </View>
              <AnimatedText delay={100} style={[styles.emptyText, { color: colors.textTertiary }]}>
                No videos in this category
              </AnimatedText>
            </View>
          }
        />
      )}
    </View>
  );
}

// -----------------------------------------------------------------------------
// Presentational subviews (loading / empty / rows)
// -----------------------------------------------------------------------------

function CategoryLoadingView({ backgroundColor }: { backgroundColor: string }) {
  const { colors } = useTheme();

  return (
    <View style={[styles.loadingContainer, { backgroundColor }]}>
      <ActivityIndicator size="small" color={colors.text} />
    </View>
  );
}

function CategoryEmptyView({
  surfaceHoverColor,
  subtitleColor,
}: {
  surfaceHoverColor: string;
  subtitleColor: string;
}) {
  return (
    <View style={styles.emptyContainer}>
      <View style={[styles.emptyIconWrapper, { backgroundColor: surfaceHoverColor }]}>
        <Ionicons name="grid-outline" size={28} color={subtitleColor} />
      </View>
      <AnimatedText delay={100} style={[styles.emptyText, { color: subtitleColor }]}>
        No videos in this category
      </AnimatedText>
    </View>
  );
}

function SubcategoryRow({
  subcategory,
  borderColor,
  textColor,
  subtitleColor,
  chevronColor,
  onPress,
}: {
  subcategory: Subcategory;
  borderColor: string;
  textColor: string;
  subtitleColor: string;
  chevronColor: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.88}
      delayPressIn={75}
      style={[styles.subcategoryRow, { borderBottomColor: borderColor }]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Open subcategory ${subcategory.name}`}
    >
      <View style={styles.subcategoryInfo}>
        <Text style={[styles.subcategoryName, { color: textColor }]}>{subcategory.name}</Text>
        <Text style={[styles.subcategoryCount, { color: subtitleColor }]}>
          {subcategory.items.length} videos
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={chevronColor} />
    </TouchableOpacity>
  );
}

function VideoRow({ item, onPress }: { item: SaveItem; onPress: () => void }) {
  const { colors } = useTheme();
  const thumbUri = useResolvedTikTokThumbnail(item.sourceURL, item.thumbnailURL);

  const openInTikTok = () => {
    if (item.sourceURL) {
      Linking.openURL(item.sourceURL);
    }
  };

  return (
    <View style={[styles.videoRow, { borderBottomColor: colors.border }]}>
      <AnimatedPressable
        style={styles.thumbnail}
        onPress={openInTikTok}
        scaleOnPress={0.97}
        accessibilityLabel="Play in TikTok"
        accessibilityRole="button"
      >
        {thumbUri ? (
          <Image
            source={{ uri: thumbUri, cache: 'force-cache' }}
            style={styles.thumbnailImage}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.thumbnailPlaceholder, { backgroundColor: colors.surfaceHover }]}>
            <Ionicons name="play" size={18} color={colors.textTertiary} />
          </View>
        )}
        {item.duration && (
          <View style={styles.durationBadge}>
            <Text style={styles.durationText}>
              {Math.floor(item.duration / 60)}:
              {String(Math.floor(item.duration % 60)).padStart(2, '0')}
            </Text>
          </View>
        )}
      </AnimatedPressable>

      <AnimatedPressable
        style={styles.videoMain}
        onPress={onPress}
        noScale
        opacityOnPress={0.6}
        accessibilityLabel={`View details for ${getDisplayTitle(item)}`}
        accessibilityRole="button"
      >
        <View style={styles.videoInfo}>
          <Text style={[styles.videoTitle, { color: colors.text }]} numberOfLines={2}>
            {getDisplayTitle(item)}
          </Text>
          {item.creatorUsername && (
            <Text style={[styles.creatorName, { color: colors.textTertiary }]}>
              @{item.creatorUsername}
            </Text>
          )}
          <Text style={[styles.timeAgo, { color: colors.textQuaternary }]}>
            {formatTimeAgo(item.dateAdded)}
          </Text>
        </View>

        <Ionicons name="chevron-forward" size={14} color={colors.textQuaternary} />
      </AnimatedPressable>
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
  listFlat: {
    flex: 1,
    minHeight: 0,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  headerTitle: {
    ...Typography.displayMd,
  },
  categoryDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  headerSubtitle: {
    ...Typography.caption,
    marginTop: Spacing.xs,
  },
  listContent: {
    paddingBottom: Spacing.xl + TAB_BAR_OVERLAP,
  },
  sectionLabel: {
    ...Typography.label,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  allVideosSection: {
    marginTop: Spacing.lg,
  },
  videoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: Hairline,
    gap: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.xs,
  },
  thumbnail: {
    width: 76,
    height: 102,
    borderRadius: BorderRadius.sm,
    overflow: 'hidden',
    backgroundColor: '#000',
    ...Shadows.xs,
    borderWidth: 1,
    borderColor: 'rgba(128, 128, 128, 0.12)',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  thumbnailPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  durationBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
  },
  durationText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#ffffff',
  },
  videoMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  videoInfo: {
    flex: 1,
    gap: 2,
  },
  videoTitle: {
    ...Typography.captionStrong,
    lineHeight: 17,
  },
  creatorName: {
    fontSize: 12,
  },
  timeAgo: {
    fontSize: 11,
    marginTop: 2,
  },
  subcategoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: Hairline,
    gap: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.xs,
    backgroundColor: 'transparent',
  },
  subcategoryInfo: {
    flex: 1,
  },
  subcategoryName: {
    ...Typography.bodyStrong,
  },
  subcategoryCount: {
    ...Typography.caption,
    marginTop: 2,
  },
  emptyContainer: {
    padding: Spacing.xxl,
    alignItems: 'center',
  },
  emptyIconWrapper: {
    width: 72,
    height: 72,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  emptyText: {
    ...Typography.body,
    textAlign: 'center',
  },
});
