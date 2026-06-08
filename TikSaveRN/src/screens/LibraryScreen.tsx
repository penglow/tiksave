/**
 * LibraryScreen
 *
 * Primary home for saved videos grouped by AI-detected topics. Library stack root;
 * supports sort preferences, pagination, pull-to-refresh, and navigation to
 * `CategoryDetail`, `AddVideo`, and `VideoDetail`.
 */

import React, { useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  RefreshControl,
  Image,
  Linking,
  ActivityIndicator,
  ScrollView,
  FlatList,
  TouchableOpacity,
  Platform,
  Modal,
  Pressable,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn } from 'react-native-reanimated';
import {
  Spacing,
  BorderRadius,
  Typography,
  CategoryColors,
  Hairline,
  Shadows,
  TAB_BAR_OVERLAP,
} from '../config';
import {
  SaveItem,
  getDisplayTitle,
  LibraryCategorySort,
  LibraryWithinTopicSort,
  LIBRARY_CATEGORY_SORT_LABELS,
  LIBRARY_WITHIN_TOPIC_LABELS,
} from '../types';
import { LibraryStackScreenProps } from '../navigation/types';
import { useTheme } from '../hooks/useTheme';
import { usePaginatedItems } from '../hooks/usePaginatedItems';
import { useResolvedTikTokThumbnail } from '../hooks/useResolvedTikTokThumbnail';
import {
  AnimatedPressable,
  AnimatedListItem,
  Skeleton,
  SkeletonVideoCard,
  AnimatedText,
  Badge,
  RotatingLogo,
  ScreenBackground,
  ScreenHeader,
  GlassSearchBar,
  FilterChipsRow,
  GridVideoCard,
} from '../components';
import { itemBelongsToLibraryCategory } from '../utils/libraryTopicFilter';
import { useAppStore } from '../stores/appStore';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type Props = LibraryStackScreenProps<'LibraryMain'>;

interface AICategory {
  name: string;
  items: SaveItem[];
  color: string;
}

// -----------------------------------------------------------------------------
// Constants & helpers — topic colors & sort orders
// -----------------------------------------------------------------------------

function getCategoryColor(topic: string): string {
  const lower = topic.toLowerCase();

  const colorMap: Record<string, keyof typeof CategoryColors> = {
    food: 'food',
    recipe: 'food',
    cooking: 'food',
    restaurant: 'food',
    travel: 'travel',
    trip: 'travel',
    vacation: 'travel',
    destination: 'travel',
    fitness: 'fitness',
    workout: 'fitness',
    gym: 'fitness',
    exercise: 'fitness',
    fashion: 'fashion',
    style: 'fashion',
    outfit: 'fashion',
    beauty: 'beauty',
    makeup: 'beauty',
    skincare: 'beauty',
    tech: 'tech',
    technology: 'tech',
    gadget: 'tech',
    finance: 'finance',
    money: 'finance',
    investing: 'finance',
    comedy: 'comedy',
    funny: 'comedy',
    humor: 'comedy',
    music: 'music',
    song: 'music',
    dance: 'dance',
    dancing: 'dance',
    choreography: 'dance',
    pets: 'pets',
    dog: 'pets',
    cat: 'pets',
    animal: 'pets',
    diy: 'diy',
    craft: 'diy',
    handmade: 'diy',
    education: 'education',
    learn: 'education',
    tutorial: 'education',
    gaming: 'gaming',
    game: 'gaming',
    esports: 'gaming',
    sports: 'sports',
    athlete: 'sports',
    basketball: 'sports',
    art: 'art',
    painting: 'art',
    artist: 'art',
    nature: 'nature',
    outdoor: 'nature',
    wildlife: 'nature',
    lifestyle: 'lifestyle',
    life: 'lifestyle',
    daily: 'lifestyle',
  };

  for (const [key, colorKey] of Object.entries(colorMap)) {
    if (lower.includes(key)) {
      return CategoryColors[colorKey];
    }
  }

  return CategoryColors.default;
}

const CATEGORY_SORT_ORDER: LibraryCategorySort[] = [
  'videos_desc',
  'videos_asc',
  'name_asc',
  'name_desc',
  'recent_activity',
];

const WITHIN_TOPIC_ORDER: LibraryWithinTopicSort[] = ['newest_first', 'oldest_first'];

// -----------------------------------------------------------------------------
// Main screen
// -----------------------------------------------------------------------------

export default function LibraryScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  // --- UI state -------------------------------------------------------------

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [sortModalOpen, setSortModalOpen] = useState(false);
  const [librarySearch, setLibrarySearch] = useState('');
  const [topicFilter, setTopicFilter] = useState('all');

  const categorySortMode = useAppStore((s) => s.userSettings.libraryCategorySort);
  const libraryWithinTopicSort = useAppStore((s) => s.userSettings.libraryWithinTopicSort);
  const updateUserSettings = useAppStore((s) => s.updateUserSettings);

  // --- Paginated library data -------------------------------------------------

  const { items, isLoading, isLoadingMore, hasMore, error, loadItems, loadMore } =
    usePaginatedItems({
      status: ['ready', 'needs_review'],
      limit: 50,
    });

  // --- Effects ----------------------------------------------------------------

  // loadItems replaces the entire in-memory dataset with page 1. Calling it on every
  // blur→focus nukes appended pages from loadMore and makes categories look wrong (RN Web FlatList reuse makes it worse).
  useFocusEffect(
    useCallback(() => {
      if (items.length === 0) {
        void loadItems();
      }
    }, [loadItems, items.length]),
  );

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadItems({ merge: true });
    setIsRefreshing(false);
  }, [loadItems]);

  // --- Derived categories -----------------------------------------------------

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
      const sortedWithin = [...categoryItems].sort((a, b) => {
        const ta = new Date(a.dateAdded).getTime();
        const tb = new Date(b.dateAdded).getTime();
        return libraryWithinTopicSort === 'newest_first' ? tb - ta : ta - tb;
      });
      result.push({
        name,
        color: getCategoryColor(name),
        items: sortedWithin,
      });
    }

    const latestTs = (c: AICategory) =>
      c.items.length === 0 ? 0 : Math.max(...c.items.map((i) => new Date(i.dateAdded).getTime()));

    switch (categorySortMode) {
      case 'videos_desc':
        return result.sort((a, b) => b.items.length - a.items.length);
      case 'videos_asc':
        return result.sort((a, b) => a.items.length - b.items.length);
      case 'name_asc':
        return result.sort((a, b) => a.name.localeCompare(b.name));
      case 'name_desc':
        return result.sort((a, b) => b.name.localeCompare(a.name));
      case 'recent_activity':
        return result.sort((a, b) => latestTs(b) - latestTs(a));
      default:
        return result.sort((a, b) => b.items.length - a.items.length);
    }
  }, [items, categorySortMode, libraryWithinTopicSort]);

  const renderCategory = useCallback(
    ({ item: category }: { item: AICategory }) => (
      <CategorySection category={category} navigation={navigation} />
    ),
    [navigation],
  );

  const ListFooter = useCallback(() => {
    if (isLoadingMore) {
      return (
        <View style={styles.loadingMoreContainer}>
          <RotatingLogo size={18} color={colors.textTertiary} pulse={false} />
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
          <Text style={[styles.loadMoreText, { color: colors.text }]}>Load more</Text>
        </AnimatedPressable>
      );
    }
    return <View style={{ height: Spacing.xxl }} />;
  }, [isLoadingMore, hasMore, loadMore, colors]);

  const webLoadGuard = useRef(false);
  const webViewportHeight = useRef(0);

  const onLibraryWebScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (Platform.OS !== 'web') return;
      const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
      const threshold = 220;
      const nearBottom =
        layoutMeasurement.height + contentOffset.y >= contentSize.height - threshold;
      if (!nearBottom || !hasMore || isLoadingMore) return;
      if (webLoadGuard.current) return;
      webLoadGuard.current = true;
      void loadMore().finally(() => {
        webLoadGuard.current = false;
      });
    },
    [hasMore, isLoadingMore, loadMore],
  );

  const maybeFillWebLibraryViewport = useCallback(
    (_contentWidth: number, contentHeight: number) => {
      if (Platform.OS !== 'web') return;
      const vh = webViewportHeight.current;
      if (vh <= 0 || contentHeight <= 0 || !hasMore || isLoadingMore) return;
      if (webLoadGuard.current) return;
      if (contentHeight > vh + 32) return;
      webLoadGuard.current = true;
      void loadMore().finally(() => {
        webLoadGuard.current = false;
      });
    },
    [hasMore, isLoadingMore, loadMore],
  );

  const filterChips = useMemo(() => {
    const topics = new Set<string>();
    for (const item of items) {
      const t = item.detectedTopics?.[0]?.split(' > ')[0]?.trim();
      if (t) topics.add(t.charAt(0).toUpperCase() + t.slice(1));
    }
    const sorted = [...topics].sort((a, b) => a.localeCompare(b));
    return [
      { id: 'all', label: 'All' },
      ...sorted.slice(0, 5).map((name) => ({
        id: name.toLowerCase(),
        label: name,
        icon: topicIcon(name) as keyof typeof Ionicons.glyphMap,
      })),
    ];
  }, [items]);

  const filteredItems = useMemo(() => {
    let list = items;
    if (topicFilter !== 'all') {
      const label = filterChips.find((c) => c.id === topicFilter)?.label ?? topicFilter;
      list = list.filter((item) => itemBelongsToLibraryCategory(item, label));
    }
    const q = librarySearch.trim().toLowerCase();
    if (q) {
      list = list.filter((item) => {
        const title = getDisplayTitle(item).toLowerCase();
        const user = (item.creatorUsername ?? '').toLowerCase();
        const topics = (item.detectedTopics ?? []).join(' ').toLowerCase();
        return title.includes(q) || user.includes(q) || topics.includes(q);
      });
    }
    return list;
  }, [items, topicFilter, librarySearch, filterChips]);

  const recentItems = useMemo(() => filteredItems.slice(0, 4), [filteredItems]);

  const filteredCategories = useMemo(() => {
    if (topicFilter === 'all' && !librarySearch.trim()) return categories;
    const ids = new Set(filteredItems.map((i) => i.id));
    return categories
      .map((c) => ({ ...c, items: c.items.filter((i) => ids.has(i.id)) }))
      .filter((c) => c.items.length > 0);
  }, [categories, filteredItems, topicFilter, librarySearch]);

  const handleRetryLoad = useCallback(() => {
    void loadItems();
  }, [loadItems]);

  const navigateToAddVideo = useCallback(() => {
    const parent = navigation.getParent();
    if (parent) {
      parent.navigate('Add' as never);
    } else {
      navigation.navigate('AddVideo');
    }
  }, [navigation]);

  // --- Render -----------------------------------------------------------------

  const ListHeader = useCallback(
    () => (
      <View>
        {recentItems.length > 0 ? (
          <View style={styles.recentSection}>
            <View style={styles.sectionRow}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Recently Saved</Text>
              <AnimatedPressable onPress={() => setSortModalOpen(true)}>
                <Text style={[styles.sortLink, { color: colors.textSecondary }]}>
                  Sort: {LIBRARY_CATEGORY_SORT_LABELS[categorySortMode]}
                </Text>
              </AnimatedPressable>
            </View>
            <View style={styles.recentGrid}>
              {recentItems.map((item, idx) => (
                <View key={item.id} style={styles.gridCell}>
                  <GridVideoCard
                    item={item}
                    onPress={() => navigation.navigate('VideoDetail', { item })}
                    featureLabel={
                      item.locationName ? 'Map detected' : item.detectedTopics?.[1] ? 'Recipe' : undefined
                    }
                  />
                </View>
              ))}
            </View>
          </View>
        ) : null}
      </View>
    ),
    [recentItems, colors, categorySortMode, navigation],
  );

  if (isLoading && items.length === 0) {
    return (
      <ScreenBackground>
        <LibraryLoadingView paddingTop={insets.top} titleColor={colors.text} />
      </ScreenBackground>
    );
  }

  if (error && items.length === 0) {
    return (
      <ScreenBackground>
        <View style={[styles.container, { paddingTop: insets.top }]}>
          <ScreenHeader title="Library" subtitle="Your saved videos" />
          <LibraryErrorView
          errorSubtleColor={colors.errorSubtle}
          errorColor={colors.error}
          textColor={colors.text}
          subtitleColor={colors.textTertiary}
          borderColor={colors.border}
          message={error}
          onRetry={handleRetryLoad}
        />
        </View>
      </ScreenBackground>
    );
  }

  if (items.length === 0) {
    return (
      <ScreenBackground>
        <View style={[styles.container, { paddingTop: insets.top }]}>
          <ScreenHeader title="Library" subtitle="0 saved videos" />
          <LibraryEmptyView
          accentSubtleColor={colors.accentSubtle}
          accentColor={colors.accent}
          textColor={colors.text}
          subtitleColor={colors.textTertiary}
          buttonBackgroundColor={colors.text}
          buttonForegroundColor={colors.background}
          onImportPress={navigateToAddVideo}
        />
        </View>
      </ScreenBackground>
    );
  }

  return (
    <>
      <ScreenBackground>
        <View style={[styles.container, { paddingTop: insets.top }]}>
          <ScreenHeader
            title="Library"
            subtitle={`${items.length} saved video${items.length === 1 ? '' : 's'}`}
          />
          <GlassSearchBar
            value={librarySearch}
            onChangeText={setLibrarySearch}
            placeholder="Search recipes, trips, edits..."
            onFilterPress={() => setSortModalOpen(true)}
            filterAccessibilityLabel="Sort library"
          />
          <FilterChipsRow
            options={filterChips}
            selectedId={topicFilter}
            onSelect={setTopicFilter}
          />

          <View style={styles.listRegion}>
            {Platform.OS === 'web' ? (
              <ScrollView
                style={styles.categoryFlatList}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled
                keyboardShouldPersistTaps="handled"
                refreshControl={
                  <RefreshControl
                    refreshing={isRefreshing}
                    onRefresh={handleRefresh}
                    tintColor={colors.text}
                  />
                }
                scrollEventThrottle={32}
                onScroll={onLibraryWebScroll}
                onLayout={(e) => {
                  webViewportHeight.current = e.nativeEvent.layout.height;
                }}
                onContentSizeChange={maybeFillWebLibraryViewport}
              >
                <ListHeader />
                {filteredCategories.map((category) => (
                  <CategorySection
                    key={category.name}
                    category={category}
                    navigation={navigation}
                  />
                ))}
                {ListFooter()}
              </ScrollView>
            ) : (
              <FlatList
                data={filteredCategories}
                renderItem={renderCategory}
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
                ListHeaderComponent={ListHeader}
                ListFooterComponent={ListFooter}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.listContent}
                style={styles.categoryFlatList}
                nestedScrollEnabled
                removeClippedSubviews={false}
                keyboardShouldPersistTaps="handled"
                windowSize={7}
                initialNumToRender={8}
                maxToRenderPerBatch={4}
                updateCellsBatchingPeriod={50}
              />
            )}
          </View>
        </View>
      </ScreenBackground>

      <Modal
        transparent
        visible={sortModalOpen}
        animationType="fade"
        onRequestClose={() => setSortModalOpen(false)}
      >
        <View style={styles.sortModalRoot}>
          <Pressable
            style={styles.sortBackdrop}
            onPress={() => setSortModalOpen(false)}
            accessibilityRole="button"
          />
          <View
            style={[
              styles.sortSheet,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.sortSheetTitle, { color: colors.text }]}>Sort library</Text>
            <ScrollView style={styles.sortScroll} showsVerticalScrollIndicator={false}>
              <Text style={[styles.sortSectionHeading, { color: colors.textTertiary }]}>
                TOPICS
              </Text>
              {CATEGORY_SORT_ORDER.map((key) => (
                <TouchableOpacity
                  key={key}
                  style={[
                    styles.sortRow,
                    categorySortMode === key ? { backgroundColor: colors.accentSubtle } : null,
                  ]}
                  onPress={() => {
                    void updateUserSettings({ libraryCategorySort: key });
                    setSortModalOpen(false);
                  }}
                >
                  <Text style={[styles.sortRowLabel, { color: colors.text }]}>
                    {LIBRARY_CATEGORY_SORT_LABELS[key]}
                  </Text>
                  {categorySortMode === key ? (
                    <Ionicons name="checkmark-circle" size={22} color={colors.accent} />
                  ) : null}
                </TouchableOpacity>
              ))}
              <Text
                style={[
                  styles.sortSectionHeading,
                  { color: colors.textTertiary, marginTop: Spacing.md },
                ]}
              >
                CLIPS IN EACH TOPIC
              </Text>
              {WITHIN_TOPIC_ORDER.map((key) => (
                <TouchableOpacity
                  key={key}
                  style={[
                    styles.sortRow,
                    libraryWithinTopicSort === key
                      ? { backgroundColor: colors.accentSubtle }
                      : null,
                  ]}
                  onPress={() => {
                    void updateUserSettings({ libraryWithinTopicSort: key });
                    setSortModalOpen(false);
                  }}
                >
                  <Text style={[styles.sortRowLabel, { color: colors.text }]}>
                    {LIBRARY_WITHIN_TOPIC_LABELS[key]}
                  </Text>
                  {libraryWithinTopicSort === key ? (
                    <Ionicons name="checkmark-circle" size={22} color={colors.accent} />
                  ) : null}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={[styles.sortDismiss, { borderTopColor: colors.border }]}
              onPress={() => setSortModalOpen(false)}
              accessibilityRole="button"
              accessibilityLabel="Close sort options"
            >
              <Text style={[styles.sortDismissLabel, { color: colors.textSecondary }]}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

// -----------------------------------------------------------------------------
// Presentational subviews (loading / error / empty / header)
// -----------------------------------------------------------------------------

function topicIcon(name: string): keyof typeof Ionicons.glyphMap | undefined {
  const n = name.toLowerCase();
  if (n.includes('food')) return 'restaurant-outline';
  if (n.includes('travel')) return 'airplane-outline';
  if (n.includes('study') || n.includes('education')) return 'book-outline';
  if (n.includes('fitness')) return 'barbell-outline';
  return undefined;
}

function LibraryLoadingView({ paddingTop, titleColor }: { paddingTop: number; titleColor: string }) {
  return (
    <View style={[styles.container, { paddingTop }]}>
      <ScreenHeader title="Library" subtitle="Loading..." />
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

function LibraryErrorView({
  errorSubtleColor,
  errorColor,
  textColor,
  subtitleColor,
  borderColor,
  message,
  onRetry,
}: {
  errorSubtleColor: string;
  errorColor: string;
  textColor: string;
  subtitleColor: string;
  borderColor: string;
  message: string;
  onRetry: () => void;
}) {
  return (
    <Animated.View entering={FadeIn.duration(200)} style={styles.emptyContainer}>
      <View style={[styles.emptyIconWrapper, { backgroundColor: errorSubtleColor }]}>
        <Ionicons name="cloud-offline-outline" size={32} color={errorColor} />
      </View>
      <AnimatedText delay={100} style={[styles.emptyTitle, { color: textColor }]}>
        Unable to load library
      </AnimatedText>
      <AnimatedText delay={200} style={[styles.emptySubtitle, { color: subtitleColor }]}>
        {message}
      </AnimatedText>
      <AnimatedPressable
        style={[styles.importButton, { borderColor }]}
        onPress={onRetry}
        haptic
        accessibilityLabel="Retry loading library"
        accessibilityRole="button"
      >
        <Ionicons name="refresh" size={18} color={textColor} />
        <Text style={[styles.importButtonText, { color: textColor }]}>Try again</Text>
      </AnimatedPressable>
    </Animated.View>
  );
}

function LibraryEmptyView({
  accentSubtleColor,
  accentColor,
  textColor,
  subtitleColor,
  buttonBackgroundColor,
  buttonForegroundColor,
  onImportPress,
}: {
  accentSubtleColor: string;
  accentColor: string;
  textColor: string;
  subtitleColor: string;
  buttonBackgroundColor: string;
  buttonForegroundColor: string;
  onImportPress: () => void;
}) {
  return (
    <Animated.View entering={FadeIn.duration(200)} style={styles.emptyContainer}>
      <View style={[styles.emptyIconWrapper, { backgroundColor: accentSubtleColor }]}>
        <Ionicons name="grid-outline" size={32} color={accentColor} />
      </View>
      <AnimatedText delay={100} style={[styles.emptyTitle, { color: textColor }]}>
        No videos yet
      </AnimatedText>
      <AnimatedText delay={200} style={[styles.emptySubtitle, { color: subtitleColor }]}>
        Import TikToks to see them{'\n'}organized by AI
      </AnimatedText>
      <AnimatedPressable
        style={[styles.importButton, { backgroundColor: buttonBackgroundColor }]}
        onPress={onImportPress}
        haptic
        accessibilityLabel="Import videos"
        accessibilityHint="Open the add video screen to import TikTok videos"
        accessibilityRole="button"
      >
        <Ionicons name="add" size={18} color={buttonForegroundColor} />
        <Text style={[styles.importButtonText, { color: buttonForegroundColor }]}>
          Import videos
        </Text>
      </AnimatedPressable>
    </Animated.View>
  );
}

// -----------------------------------------------------------------------------
// Subcomponents — category section & video card
// -----------------------------------------------------------------------------

const CategorySection = React.memo(function CategorySection({
  category,
  navigation,
}: {
  category: AICategory;
  navigation: Props['navigation'];
}) {
  const { colors } = useTheme();

  return (
    <View style={styles.categorySection}>
      {/* Category Header */}
      <TouchableOpacity
        activeOpacity={0.92}
        delayPressIn={75}
        style={[styles.categoryHeader, { backgroundColor: colors.surface }]}
        onPress={() =>
          navigation.navigate('CategoryDetail', {
            categoryName: category.name,
            icon: '',
            color: category.color,
          })
        }
        accessibilityRole="button"
        accessibilityLabel={`Open expanded view for topic ${category.name}`}
        accessibilityHint="Shows every clip grouped in this topic"
      >
        <View style={styles.categoryTitleBlock}>
          <View style={styles.categoryTitleRow}>
            <View style={[styles.categoryDot, { backgroundColor: category.color }]} />
            <Text style={[styles.categoryName, { color: colors.text }]} numberOfLines={1}>
              {category.name}
            </Text>
          </View>
          <Text
            style={[styles.categoryExpandHint, { color: colors.textQuaternary }]}
            numberOfLines={1}
          >
            Tap for expanded topic · {category.items.length}{' '}
            {category.items.length === 1 ? 'clip' : 'clips'}
          </Text>
        </View>
        <View style={styles.categoryMeta}>
          <Badge label={`${category.items.length}`} variant="ghost" size="sm" />
          <View style={[styles.chevronCircle, { backgroundColor: colors.surfaceHover }]}>
            <Ionicons name="chevron-forward" size={12} color={colors.textTertiary} />
          </View>
        </View>
      </TouchableOpacity>

      {/* Horizontal carousel — paired with outer vertical ScrollView on web so wheel scroll chains correctly */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={Platform.OS === 'web'}
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
        directionalLockEnabled
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

        {category.items.length > 6 && (
          <TouchableOpacity
            activeOpacity={0.9}
            delayPressIn={75}
            style={[
              styles.seeMoreCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
            onPress={() =>
              navigation.navigate('CategoryDetail', {
                categoryName: category.name,
                icon: '',
                color: category.color,
              })
            }
            accessibilityRole="button"
            accessibilityLabel={`See ${category.items.length - 6} more videos in ${category.name}`}
          >
            <View style={[styles.seeMoreDot, { backgroundColor: category.color }]} />
            <Text style={[styles.seeMoreCount, { color: colors.text }]}>
              +{category.items.length - 6}
            </Text>
            <Text style={[styles.seeMoreLabel, { color: colors.textTertiary }]}>more</Text>
            <Ionicons name="arrow-forward" size={14} color={colors.textQuaternary} />
          </TouchableOpacity>
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
  const thumbUri = useResolvedTikTokThumbnail(item.sourceURL, item.thumbnailURL);

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
        {thumbUri ? (
          <Image
            source={{ uri: thumbUri, cache: 'force-cache' }}
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
              {Math.floor(item.duration / 60)}:
              {String(Math.floor(item.duration % 60)).padStart(2, '0')}
            </Text>
          </View>
        )}
      </AnimatedPressable>

      {/* Info — delayPressIn so vertical pans can scroll the library list / outer scrollviews */}
      <TouchableOpacity
        activeOpacity={0.65}
        delayPressIn={75}
        style={styles.videoInfo}
        onPress={onPress}
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
      </TouchableOpacity>
    </View>
  );
});

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 0,
  },
  /** Flexbox: minHeight 0 bounds the FlatList so it can scroll inside the column layout */
  listRegion: {
    flex: 1,
    minHeight: 0,
  },
  categoryFlatList: {
    flex: 1,
    minHeight: 0,
    ...Platform.select({
      web: {
        overflowY: 'auto',
        overscrollBehaviorY: 'auto',
      },
      default: {},
    }),
  },
  header: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
  },
  heroHeader: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  brandLabel: {
    ...Typography.label,
    fontSize: 10,
    letterSpacing: 1.6,
  },
  brandLive: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 'auto',
  },
  brandLiveLabel: {
    ...Typography.label,
    fontSize: 9,
    letterSpacing: 1.4,
  },
  headerCountNumber: {
    ...Typography.body,
    fontVariant: ['tabular-nums'],
    fontWeight: '700',
    marginRight: 2,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  headerTitleWrap: {
    flex: 1,
    gap: Spacing.xs,
  },
  headerTitle: {
    ...Typography.displayMd,
    fontSize: 34,
    lineHeight: 38,
  },
  headerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  headerCountDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  headerCount: {
    ...Typography.caption,
  },
  headerAction: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.sm,
  },
  sortModalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sortBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.48)',
  },
  sortSheet: {
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md + TAB_BAR_OVERLAP,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    maxHeight: '72%',
    overflow: 'hidden',
    ...Shadows.md,
  },
  sortSheetTitle: {
    ...Typography.headingSm,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  sortScroll: {
    maxHeight: 420,
    paddingHorizontal: Spacing.sm,
  },
  sortSectionHeading: {
    ...Typography.label,
    letterSpacing: 1.4,
    fontSize: 10,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    marginHorizontal: Spacing.xs,
    marginBottom: 2,
    borderRadius: BorderRadius.sm,
  },
  sortRowLabel: {
    ...Typography.body,
    flex: 1,
    marginRight: Spacing.sm,
  },
  sortDismiss: {
    borderTopWidth: Hairline,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sortDismissLabel: {
    ...Typography.bodyStrong,
  },
  listContent: {
    paddingBottom: Spacing.xl + TAB_BAR_OVERLAP,
  },
  recentSection: {
    paddingHorizontal: Spacing.screen,
    marginBottom: Spacing.lg,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    ...Typography.headingSm,
    fontWeight: '700',
  },
  sortLink: {
    ...Typography.caption,
    fontSize: 13,
  },
  recentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  gridCell: {
    flex: 1,
    flexBasis: '48%',
    maxWidth: '48%',
    minWidth: 140,
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
    paddingVertical: Spacing.md,
    marginBottom: Spacing.md,
    marginHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    ...Shadows.xs,
  },
  categoryTitleBlock: {
    flex: 1,
    minWidth: 0,
    gap: 2,
    marginRight: Spacing.sm,
  },
  categoryExpandHint: {
    ...Typography.caption,
    fontSize: 11,
    opacity: 0.95,
    marginLeft: 18,
  },
  categoryTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  categoryName: {
    ...Typography.headingSm,
    flexShrink: 1,
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
  chevronCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
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
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    backgroundColor: '#000',
    ...Shadows.sm,
    borderWidth: 1,
    borderColor: 'rgba(128, 128, 128, 0.12)',
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
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    gap: Spacing.xs,
    ...Shadows.xs,
  },
  seeMoreDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginBottom: Spacing.xs,
  },
  seeMoreCount: {
    ...Typography.headingSm,
  },
  seeMoreLabel: {
    ...Typography.caption,
    marginBottom: Spacing.xs,
  },
});
