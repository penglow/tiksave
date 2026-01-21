import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Image,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeOut, Layout } from 'react-native-reanimated';

import { Spacing, BorderRadius, Typography, CategoryColors, Hairline } from '../config';
import { SaveItem, getDisplayTitle } from '../types';
import { apiService } from '../services/api';
import { LibraryStackScreenProps } from '../navigation/types';
import { useTheme } from '../hooks/useTheme';
import { AnimatedPressable, AnimatedListItem, Skeleton, SkeletonVideoCard, AnimatedText } from '../components';

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
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<SaveItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadItems = useCallback(async () => {
    try {
      const allItems = await apiService.getItems();
      const readyItems = allItems.filter(item => item.status === 'ready');
      setItems(readyItems);
    } catch (error) {
      console.error('Failed to load items:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadItems();
    }, [loadItems])
  );

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadItems();
  };

  // Group items by AI-detected topics
  const categories = useMemo(() => {
    const categoryMap = new Map<string, SaveItem[]>();

    for (const item of items) {
      let primaryTopic = item.detectedTopics?.[0] || 'Saved';

      // Handle hierarchical topics (e.g., "Food > Japanese")
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

  // Loading state
  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <View style={styles.header}>
          <AnimatedText style={[styles.headerTitle, { color: colors.text }]}>Library</AnimatedText>
        </View>
        <View style={styles.skeletonContainer}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={styles.skeletonCategory}>
              <Skeleton width={100} height={20} style={{ marginBottom: 12 }} />
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

  // Empty state
  if (items.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <View style={styles.header}>
          <AnimatedText style={[styles.headerTitle, { color: colors.text }]}>Library</AnimatedText>
        </View>
        <Animated.View
          entering={FadeIn.duration(150)}
          style={styles.emptyContainer}
        >
          <View style={[styles.emptyIconWrapper, { backgroundColor: colors.accentSubtle }]}>
            <Ionicons name="grid-outline" size={32} color={colors.textTertiary} />
          </View>
          <AnimatedText delay={100} style={[styles.emptyTitle, { color: colors.text }]}>
            No videos yet
          </AnimatedText>
          <AnimatedText delay={200} style={[styles.emptySubtitle, { color: colors.textTertiary }]}>
            Import TikToks to see them{'\n'}organized by AI
          </AnimatedText>
          <AnimatedPressable
            style={[styles.importButton, { borderColor: colors.border }]}
            onPress={() => navigation.navigate('AddVideo')}
            haptic
          >
            <Ionicons name="add" size={18} color={colors.text} />
            <Text style={[styles.importButtonText, { color: colors.text }]}>
              Import videos
            </Text>
          </AnimatedPressable>
        </Animated.View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <AnimatedText style={[styles.headerTitle, { color: colors.text }]}>Library</AnimatedText>
        <Text style={[styles.headerCount, { color: colors.textTertiary }]}>
          {items.length} videos
        </Text>
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
        {categories.map((category, categoryIndex) => (
          <AnimatedListItem
            key={category.name}
            index={categoryIndex}
            direction="fade"
            style={styles.categorySection}
          >
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
                <Text style={[styles.categoryName, { color: colors.text }]}>
                  {category.name}
                </Text>
                <View style={[styles.categoryDot, { backgroundColor: category.color }]} />
              </View>
              <View style={styles.categoryMeta}>
                <Text style={[styles.categoryCount, { color: colors.textTertiary }]}>
                  {category.items.length} videos
                </Text>
                <Ionicons name="chevron-forward" size={14} color={colors.textQuaternary} />
              </View>
            </AnimatedPressable>

            {/* Video Row */}
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
                  style={[styles.seeMoreCard, { backgroundColor: colors.accentSubtle }]}
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
          </AnimatedListItem>
        ))}

        {/* Bottom padding */}
        <View style={{ height: Spacing.xxl }} />
      </ScrollView>
    </View>
  );
}

// Video Card Component
function VideoCard({
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

  return (
    <View style={styles.videoCard}>
      {/* Thumbnail */}
      <AnimatedPressable
        style={styles.thumbnailWrapper}
        onPress={onPlayPress}
        scaleOnPress={0.98}
      >
        {item.thumbnailURL ? (
          <Image
            source={{ uri: item.thumbnailURL, cache: 'force-cache' }}
            style={styles.thumbnail}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.thumbnailPlaceholder, { backgroundColor: colors.accentSubtle }]}>
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
      >
        <Text style={[styles.videoTitle, { color: colors.text }]} numberOfLines={2}>
          {getDisplayTitle(item)}
        </Text>
        {item.creatorUsername && (
          <Text style={[styles.creatorName, { color: colors.textTertiary }]}>
            @{item.creatorUsername}
          </Text>
        )}
      </AnimatedPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
  },
  headerTitle: {
    ...Typography.displayMd,
  },
  headerCount: {
    ...Typography.caption,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: Spacing.xl,
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
    marginBottom: Spacing.lg,
  },
  importButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
  },
  importButtonText: {
    ...Typography.bodyStrong,
  },

  // Category section
  categorySection: {
    marginBottom: Spacing.xl,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
  },
  categoryTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  categoryName: {
    ...Typography.heading,
  },
  categoryDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  categoryMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  categoryCount: {
    ...Typography.caption,
  },

  // Video row
  videoRow: {
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  videoCard: {
    width: 140,
  },
  thumbnailWrapper: {
    width: 140,
    height: 186,
    borderRadius: BorderRadius.xs,
    overflow: 'hidden',
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
    bottom: 6,
    right: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
  },
  durationText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#ffffff',
  },
  videoInfo: {
    paddingTop: Spacing.xs,
  },
  videoTitle: {
    ...Typography.captionStrong,
    lineHeight: 16,
  },
  creatorName: {
    fontSize: 12,
    marginTop: 2,
  },

  // See more card
  seeMoreCard: {
    width: 80,
    height: 186,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  seeMoreCount: {
    ...Typography.headingSm,
  },
  seeMoreLabel: {
    ...Typography.caption,
  },
});
