import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Image,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Spacing, BorderRadius, Typography, Hairline } from '../config';
import { SaveItem, getDisplayTitle } from '../types';
import { apiService } from '../services/api';
import { LibraryStackScreenProps } from '../navigation/types';
import { formatTimeAgo } from '../utils/date';
import { useTheme } from '../hooks/useTheme';
import { AnimatedPressable, AnimatedListItem, AnimatedText } from '../components';

type Props = LibraryStackScreenProps<'CategoryDetail'>;

interface Subcategory {
  name: string;
  items: SaveItem[];
}

export default function CategoryDetailScreen({ route, navigation }: Props) {
  const { categoryName, color, subcategoryName } = route.params;
  const { colors } = useTheme();
  const [items, setItems] = useState<SaveItem[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadItems = useCallback(async () => {
    try {
      const allItems = await apiService.getItems();

      const categoryItems = allItems.filter(item => {
        if (item.status !== 'ready') return false;
        const primaryTopic = item.detectedTopics?.[0] || 'Saved';

        let parentName = primaryTopic;
        let subName: string | null = null;

        if (primaryTopic.includes(' > ')) {
          const parts = primaryTopic.split(' > ');
          parentName = parts[0].trim();
          subName = parts[1]?.trim() || null;
        }

        parentName = parentName.charAt(0).toUpperCase() + parentName.slice(1);

        if (subcategoryName) {
          return parentName === categoryName && subName === subcategoryName;
        }

        return parentName === categoryName;
      });

      if (subcategoryName) {
        setItems(categoryItems.sort((a, b) =>
          new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime()
        ));
      } else {
        const subcategoryMap = new Map<string, SaveItem[]>();

        for (const item of categoryItems) {
          const primaryTopic = item.detectedTopics?.[0] || 'Saved';
          let subName: string | null = null;

          if (primaryTopic.includes(' > ')) {
            const parts = primaryTopic.split(' > ');
            subName = parts[1]?.trim() || null;
          }

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
            items: subItems.sort((a, b) =>
              new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime()
            ),
          });
        }

        setSubcategories(subcategoriesList.sort((a, b) => b.items.length - a.items.length));
        setItems(categoryItems);
      }
    } catch (error) {
      console.error('Failed to load items:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [categoryName, subcategoryName]);

  useFocusEffect(
    useCallback(() => {
      loadItems();
    }, [loadItems])
  );

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadItems();
  };

  const renderVideoItem = ({ item, index }: { item: SaveItem; index: number }) => (
    <AnimatedListItem index={index} direction="fade">
      <VideoRow
        item={item}
        onPress={() => navigation.navigate('VideoDetail', { item })}
      />
    </AnimatedListItem>
  );

  const renderSubcategoryItem = ({ item: subcategory, index }: { item: Subcategory; index: number }) => (
    <AnimatedListItem index={index} direction="fade">
      <AnimatedPressable
        style={[styles.subcategoryRow, { borderBottomColor: colors.border }]}
        onPress={() => navigation.navigate('CategoryDetail', {
          categoryName,
          icon: '',
          color,
          subcategoryName: subcategory.name,
        })}
      >
        <View style={styles.subcategoryInfo}>
          <Text style={[styles.subcategoryName, { color: colors.text }]}>
            {subcategory.name}
          </Text>
          <Text style={[styles.subcategoryCount, { color: colors.textTertiary }]}>
            {subcategory.items.length} videos
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.textQuaternary} />
      </AnimatedPressable>
    </AnimatedListItem>
  );

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="small" color={colors.text} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <Animated.View entering={FadeIn.duration(300)} style={styles.header}>
        <View style={styles.headerTitleRow}>
          <AnimatedText style={[styles.headerTitle, { color: colors.text }]}>
            {subcategoryName || categoryName}
          </AnimatedText>
          <View style={[styles.categoryDot, { backgroundColor: color }]} />
        </View>
        <Text style={[styles.headerSubtitle, { color: colors.textTertiary }]}>
          {subcategoryName
            ? `${items.length} videos`
            : `${items.length} videos · ${subcategories.length} subcategories`
          }
        </Text>
      </Animated.View>

      {subcategoryName ? (
        <FlatList
          data={items}
          renderItem={renderVideoItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={colors.text}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <AnimatedText delay={100} style={[styles.emptyText, { color: colors.textTertiary }]}>
                No videos in this category
              </AnimatedText>
            </View>
          }
        />
      ) : (
        <FlatList
          data={subcategories.length > 0 ? subcategories : []}
          renderItem={renderSubcategoryItem}
          keyExtractor={(item) => item.name}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={colors.text}
            />
          }
          ListHeaderComponent={
            subcategories.length > 0 ? (
              <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>
                SUBCATEGORIES
              </Text>
            ) : null
          }
          ListFooterComponent={
            items.length > 0 ? (
              <View style={styles.allVideosSection}>
                <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>
                  ALL VIDEOS
                </Text>
                {items.slice(0, 10).map((item, index) => (
                  <AnimatedListItem key={item.id} index={index} direction="fade">
                    <VideoRow
                      item={item}
                      onPress={() => navigation.navigate('VideoDetail', { item })}
                    />
                  </AnimatedListItem>
                ))}
              </View>
            ) : null
          }
          ListEmptyComponent={
            items.length === 0 ? (
              <View style={styles.emptyContainer}>
                <AnimatedText delay={100} style={[styles.emptyText, { color: colors.textTertiary }]}>
                  No videos in this category
                </AnimatedText>
              </View>
            ) : null
          }
        />
      )}
    </View>
  );
}

function VideoRow({
  item,
  onPress
}: {
  item: SaveItem;
  onPress: () => void;
}) {
  const { colors } = useTheme();

  const openInTikTok = () => {
    if (item.sourceURL) {
      Linking.openURL(item.sourceURL);
    }
  };

  return (
    <AnimatedPressable
      style={[styles.videoRow, { borderBottomColor: colors.border }]}
      onPress={onPress}
    >
      {/* Thumbnail */}
      <AnimatedPressable
        style={styles.thumbnail}
        onPress={openInTikTok}
        scaleOnPress={0.98}
      >
        {item.thumbnailURL ? (
          <Image
            source={{ uri: item.thumbnailURL, cache: 'force-cache' }}
            style={styles.thumbnailImage}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.thumbnailPlaceholder, { backgroundColor: colors.accentSubtle }]}>
            <Ionicons name="play" size={18} color={colors.textTertiary} />
          </View>
        )}
        {item.duration && (
          <View style={styles.durationBadge}>
            <Text style={styles.durationText}>
              {Math.floor(item.duration / 60)}:{String(Math.floor(item.duration % 60)).padStart(2, '0')}
            </Text>
          </View>
        )}
      </AnimatedPressable>

      {/* Info */}
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
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  headerSubtitle: {
    ...Typography.caption,
    marginTop: Spacing.xs,
  },
  listContent: {
    paddingBottom: Spacing.xl,
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
  },
  thumbnail: {
    width: 70,
    height: 93,
    borderRadius: BorderRadius.xs,
    overflow: 'hidden',
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
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: BorderRadius.xs,
  },
  durationText: {
    fontSize: 10,
    fontWeight: '500',
    color: '#ffffff',
  },
  videoInfo: {
    flex: 1,
    gap: 2,
  },
  videoTitle: {
    ...Typography.captionStrong,
    lineHeight: 16,
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
  emptyText: {
    ...Typography.body,
  },
});
