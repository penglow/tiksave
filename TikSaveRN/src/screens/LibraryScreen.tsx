import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Image,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeOut, Layout } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

import { Spacing, BorderRadius, Typography, CategoryColors, Hairline, Gradients } from '../config';
import { SaveItem, getDisplayTitle } from '../types';
import { APIError } from '../services/api';
import { LibraryStackScreenProps } from '../navigation/types';
import { useTheme } from '../hooks/useTheme';
import { usePaginatedItems } from '../hooks/usePaginatedItems';
import { AnimatedPressable, AnimatedListItem, Skeleton, SkeletonVideoCard, AnimatedText, Badge } from '../components';

type Props = LibraryStackScreenProps<'LibraryMain'>;

interface AICategory {
  name: string;
  items: SaveItem[];
  color: string;
}

function getCategoryColor(topic: string): string {
  const lower = topic.toLowerCase();

  const colorMap: Record<string, keyof typeof CategoryColors> = {
    food: 'food', recipe: 'food', cooking: 'food', restaurant: 'food',
    travel: 'travel', trip: 'travel', vacation: 'travel', destination: 'travel',
    fitness: 'fitness', workout: 'fitness', gym: 'fitness', exercise: 'fitness',
    fashion: 'fashion', style: 'fashion', outfit: 'fashion',
    beauty: 'beauty', makeup: 'beauty', skincare: 'beauty',
    tech: 'tech', technology: 'tech', gadget: 'tech',
    finance: 'finance', money: 'finance', investing: 'finance',
    comedy: 'comedy', funny: 'comedy', humor: 'comedy',
    music: 'music', song: 'music',
    dance: 'dance', dancing: 'dance', choreography: 'dance',
    pets: 'pets', dog: 'pets', cat: 'pets', animal: 'pets',
    diy: 'diy', craft: 'diy', handmade: 'diy',
    education: 'education', learn: 'education', tutorial: 'education',
    gaming: 'gaming', game: 'gaming', esports: 'gaming',
    sports: 'sports', athlete: 'sports', basketball: 'sports',
    art: 'art', painting: 'art', artist: 'art',
    nature: 'nature', outdoor: 'nature', wildlife: 'nature',
    lifestyle: 'lifestyle', life: 'lifestyle', daily: 'lifestyle',
  };

  for (const [key, colorKey] of Object.entries(colorMap)) {
    if (lower.includes(key)) {
      return CategoryColors[colorKey];
    }
  }

  return CategoryColors.default;
}

export default function LibraryScreen({ navigation }: Props) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const {
    items,
    isLoading,
    isLoadingMore,
    hasMore,
    error,
    loadItems,
    loadMore,
    refresh,
  } = usePaginatedItems({ status: 'ready', limit: 50 });

  useFocusEffect(
    useCallback(() => {
      if (items.length === 0) {
        loadItems();
      }
    }, [loadItems, items.length])
  );

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadItems();
    setIsRefreshing(false);
  }, [loadItems]);

  const categories = useMemo(() => {
    const categoryMap = new Map<string, SaveItem[]>();

    for (const item of items) {
      let primaryTopic = item.detectedTopics?.[0] || 'Saved';

      if (primaryTopic.includes(' > ')) {
        primaryTopic = primaryTopic.split(' > ')[0].trim();
      }

      primaryTopic = primaryTopic.charAt(0).toUpperCase() + primaryTopic.slice(1);

      if (!categoryMap.has(primaryTopic)) {
        categoryMap.set(primaryTopic, []);
      }
      categoryMap.get(primaryTopic)!.push(item);
    }

    const result: AICategory[] = [];
    for (const [name, categoryItems] of categoryMap) {
      result.push({
        name,
        color: getCategoryColor(name),
        items: categoryItems.sort((a, b) =>
          new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime()
        ),
      });
    }

    return result.sort((a, b) => b.items.length - a.items.length);
  }, [items]);

  const renderCategory = useCallback(({ item: category, index }: { item: AICategory; index: number }) => (
    <CategorySection
      category={category}
      index={index}
      navigation={navigation}
    />
  ), [navigation]);

  const ListFooter = useCallback(() => {
    if (isLoadingMore) {
      return (
        <View style={styles.loadingMoreContainer}>
          <ActivityIndicator size="small" color={colors.textTertiary} />
          <Text style={[styles.loadingMoreText, { color: colors.textTertiary }]}>
            Loading more...
          </Text>
        </View>
      );
    }
    if (hasMore) {
      return (
        <AnimatedPressable
          style={[styles.loadMoreButton, { borderColor: colors.border }]}
          onPress={loadMore}
        >
          <Text style={[styles.loadMoreText, { color: colors.text }]}>
            Load more
          </Text>
        </AnimatedPressable>
      );
    }
    return <View style={{ height: Spacing.xxl }} />;
  }, [isLoadingMore, hasMore, loadMore, colors]);

  const heroGradient = isDark ? Gradients.heroDark : Gradients.heroLight;

  if (isLoading && items.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <View style={styles.header}>
          <AnimatedText style={[styles.headerTitle, { color: colors.text }]}>Library</AnimatedText>
        </View>
        <View style={styles.skeletonContainer}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={styles.skeletonCategory}>
              <Skeleton width={120} height={22} style={{ marginBottom: 14 }} />
              <View style={styles.skeletonRow}>
                <SkeletonVideoCard />
                <SkeletonVideoCard />
                <SkeletonVideoCard />
              </View>
            </View>
          ))}
        </View>
      </View>
    );
  }

  if (error && items.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <View style={styles.header}>
          <AnimatedText style={[styles.headerTitle, { color: colors.text }]}>Library</AnimatedText>
        </View>
        <Animated.View entering={FadeIn.duration(200)} style={styles.emptyContainer}>
          <View style={[styles.emptyIconWrapper, { backgroundColor: colors.errorSubtle }]}>
            <Ionicons name="cloud-offline-outline" size={32} color={colors.error} />
          </View>
          <AnimatedText delay={100} style={[styles.emptyTitle, { color: colors.text }]}>
            Unable to load library
          </AnimatedText>
          <AnimatedText delay={200} style={[styles.emptySubtitle, { color: colors.textTertiary }]}>
            {error}
          </AnimatedText>
          <AnimatedPressable
            style={[styles.importButton, { borderColor: colors.border }]}
            onPress={loadItems}
            haptic
            accessibilityLabel="Retry loading library"
            accessibilityRole="button"
          >
            <Ionicons name="refresh" size={18} color={colors.text} />
            <Text style={[styles.importButtonText, { color: colors.text }]}>
              Try again
            </Text>
          </AnimatedPressable>
        </Animated.View>
      </View>
    );
  }

  if (items.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <View style={styles.header}>
          <AnimatedText style={[styles.headerTitle, { color: colors.text }]}>Library</AnimatedText>
        </View>
        <Animated.View entering={FadeIn.duration(200)} style={styles.emptyContainer}>
          <View style={[styles.emptyIconWrapper, { backgroundColor: colors.accentSubtle }]}>
            <Ionicons name="grid-outline" size={32} color={colors.accent} />
          </View>
          <AnimatedText delay={100} style={[styles.emptyTitle, { color: colors.text }]}>
            No videos yet
          </AnimatedText>
          <AnimatedText delay={200} style={[styles.emptySubtitle, { color: colors.textTertiary }]}>
            Import TikToks to see them{'\n'}organized by AI
          </AnimatedText>
          <AnimatedPressable
            style={[styles.importButton, { backgroundColor: colors.text }]}
            onPress={() => navigation.navigate('AddVideo')}
            haptic
            accessibilityLabel="Import videos"
            accessibilityHint="Open the add video screen to import TikTok videos"
            accessibilityRole="button"
          >
            <Ionicons name="add" size={18} color={colors.background} />
            <Text style={[styles.importButtonText, { color: colors.background }]}>
              Import videos
            </Text>
          </AnimatedPressable>
        </Animated.View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {/* Hero Header with gradient */}
      <LinearGradient colors={heroGradient} style={styles.heroHeader}>
        <View style={styles.headerContent}>
          <View>
            <AnimatedText style={[styles.headerTitle, { color: colors.text }]}>Library</AnimatedText>
            <Text style={[styles.headerCount, { color: colors.textTertiary }]}>
              {items.length} video{items.length !== 1 ? 's' : ''}
            </Text>
          </View>
          <AnimatedPressable
            style={[styles.headerAction, { backgroundColor: colors.surfaceHover }]}
            onPress={() => navigation.navigate('AddVideo')}
            haptic
          >
            <Ionicons name="add" size={20} color={colors.text} />
          </AnimatedPressable>
        </View>
      </LinearGradient>

      {/* Virtualized Category List */}
      <FlashList
        data={categories}
        renderItem={renderCategory}
        estimatedItemSize={280}
        keyExtractor={(item) => item.name}
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.text}
          />
        }
        ListFooterComponent={ListFooter}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

const CategorySection = React.memo(function CategorySection({
  category,
  index,
  navigation,
}: {
  category: AICategory;
  index: number;
  navigation: Props['navigation'];
}) {
  const { colors } = useTheme();

  return (
    <View style={styles.categorySection}>
      {/* Category Header */}
      <AnimatedPressable
        style={styles.categoryHeader}
        onPress={() => navigation.navigate('CategoryDetail', {
          categoryName: category.name,
          icon: '',
          color: category.color,
        })}
      >
        <View style={styles.categoryTitleRow}>
          <View style={[styles.categoryDot, { backgroundColor: category.color }]} />
          <Text style={[styles.categoryName, { color: colors.text }]}>
            {category.name}
          </Text>
        </View>
        <View style={styles.categoryMeta}>
          <Badge label={`${category.items.length}`} variant="ghost" size="sm" />
          <Ionicons name="chevron-forward" size={14} color={colors.textQuaternary} />
        </View>
      </AnimatedPressable>

      {/* Video Row - Horizontal scrolling */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.videoRow}
      >
        {category.items.slice(0, 6).map((item, itemIndex) => (
          <VideoCard
            key={item.id}
            item={item}
            index={itemIndex}
            onPress={() => navigation.navigate('VideoDetail', { item })}
            onPlayPress={() => item.sourceURL && Linking.openURL(item.sourceURL)}
          />
        ))}

        {/* See More Card */}
        {category.items.length > 6 && (
          <AnimatedPressable
            style={[styles.seeMoreCard, { backgroundColor: colors.surfaceHover, borderColor: colors.border }]}
            onPress={() => navigation.navigate('CategoryDetail', {
              categoryName: category.name,
              icon: '',
              color: category.color,
            })}
          >
            <Text style={[styles.seeMoreCount, { color: colors.text }]}>
              +{category.items.length - 6}
            </Text>
            <Text style={[styles.seeMoreLabel, { color: colors.textTertiary }]}>
              more
            </Text>
          </AnimatedPressable>
        )}
      </ScrollView>
    </View>
  );
});

const VideoCard = React.memo(function VideoCard({
  item,
  index,
  onPress,
  onPlayPress,
}: {
  item: SaveItem;
  index: number;
  onPress: () => void;
  onPlayPress: () => void;
}) {
  const { colors } = useTheme();
  const title = getDisplayTitle(item);

  return (
    <View style={styles.videoCard}>
      {/* Thumbnail */}
      <AnimatedPressable
        style={styles.thumbnailWrapper}
        onPress={onPlayPress}
        scaleOnPress={0.97}
        accessibilityLabel={`Play ${title} in TikTok`}
        accessibilityHint="Opens the video in the TikTok app"
        accessibilityRole="button"
      >
        {item.thumbnailURL ? (
          <Image
            source={{ uri: item.thumbnailURL, cache: 'force-cache' }}
            style={styles.thumbnail}
            resizeMode="cover"
            accessibilityIgnoresInvertColors
          />
        ) : (
          <View style={[styles.thumbnailPlaceholder, { backgroundColor: colors.surfaceHover }]}>
            <Ionicons name="play" size={24} color={colors.textTertiary} />
          </View>
        )}

        {/* Duration Badge */}
        {item.duration && (
          <View style={styles.durationBadge}>
            <Text style={styles.durationText}>
              {Math.floor(item.duration / 60)}:{String(Math.floor(item.duration % 60)).padStart(2, '0')}
            </Text>
          </View>
        )}
      </AnimatedPressable>

      {/* Info */}
      <AnimatedPressable
        style={styles.videoInfo}
        onPress={onPress}
        noScale
        opacityOnPress={0.6}
        accessibilityLabel={`View details for ${title}${item.creatorUsername ? ` by @${item.creatorUsername}` : ''}`}
        accessibilityRole="button"
      >
        <Text style={[styles.videoTitle, { color: colors.text }]} numberOfLines={2}>
          {title}
        </Text>
        {item.creatorUsername && (
          <Text style={[styles.creatorName, { color: colors.textTertiary }]}>
            @{item.creatorUsername}
          </Text>
        )}
      </AnimatedPressable>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
  },
  heroHeader: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  headerTitle: {
    ...Typography.displayMd,
  },
  headerCount: {
    ...Typography.caption,
    marginTop: Spacing.xs,
  },
  headerAction: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingBottom: Spacing.xl,
  },

  // Loading more
  loadingMoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  loadingMoreText: {
    ...Typography.bodySm,
  },
  loadMoreButton: {
    alignItems: 'center',
    padding: Spacing.md,
    marginHorizontal: Spacing.md,
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
  },
  loadMoreText: {
    ...Typography.bodyStrong,
  },

  // Loading state
  skeletonContainer: {
    padding: Spacing.md,
  },
  skeletonCategory: {
    marginBottom: Spacing.xl,
  },
  skeletonRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },

  // Empty state
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
  },
  emptySubtitle: {
    ...Typography.body,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  importButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.sm,
  },
  importButtonText: {
    ...Typography.bodyStrong,
  },

  // Category section
  categorySection: {
    marginBottom: Spacing.xxl,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.md,
  },
  categoryTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  categoryName: {
    ...Typography.headingSm,
  },
  categoryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  categoryMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },

  // Video row
  videoRow: {
    paddingHorizontal: Spacing.md,
    gap: Spacing.md,
  },
  videoCard: {
    width: 152,
  },
  thumbnailWrapper: {
    width: 152,
    height: 202,
    borderRadius: BorderRadius.sm,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  thumbnailPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
    fontSize: 11,
    fontWeight: '600',
    color: '#ffffff',
  },
  videoInfo: {
    paddingTop: Spacing.sm,
  },
  videoTitle: {
    ...Typography.captionStrong,
    lineHeight: 17,
  },
  creatorName: {
    fontSize: 12,
    marginTop: 2,
  },

  // See more card
  seeMoreCard: {
    width: 88,
    height: 202,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  seeMoreCount: {
    ...Typography.headingSm,
  },
  seeMoreLabel: {
    ...Typography.caption,
  },
});
