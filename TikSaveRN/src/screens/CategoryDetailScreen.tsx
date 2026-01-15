import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

import { Colors, Spacing, BorderRadius } from '../config';
import { SaveItem, getDisplayTitle } from '../types';
import { apiService } from '../services/api';
import { LibraryStackScreenProps } from '../navigation/types';
import { formatTimeAgo } from '../utils/date';

type Props = LibraryStackScreenProps<'CategoryDetail'>;

interface Subcategory {
  name: string;
  items: SaveItem[];
}

export default function CategoryDetailScreen({ route, navigation }: Props) {
  const { categoryName, icon, color, subcategoryName } = route.params;
  const [items, setItems] = useState<SaveItem[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadItems = useCallback(async () => {
    try {
      const allItems = await apiService.getItems();
      
      // Filter items that belong to this category (handles hierarchical "Parent > Subcategory" format)
      const categoryItems = allItems.filter(item => {
        if (item.status !== 'ready') return false;
        const primaryTopic = item.detectedTopics?.[0] || 'Saved';
        
        // Parse hierarchical category
        let parentName = primaryTopic;
        let subName: string | null = null;
        
        if (primaryTopic.includes(' > ')) {
          const parts = primaryTopic.split(' > ');
          parentName = parts[0].trim();
          subName = parts[1]?.trim() || null;
        }
        
        // Normalize parent name for comparison
        parentName = parentName.charAt(0).toUpperCase() + parentName.slice(1);
        
        // If subcategoryName is provided, filter by both parent and subcategory
        if (subcategoryName) {
          return parentName === categoryName && subName === subcategoryName;
        }
        
        // Otherwise, filter by parent category only
        return parentName === categoryName;
      });

      if (subcategoryName) {
        // Show videos for the selected subcategory
        setItems(categoryItems.sort((a, b) => 
          new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime()
        ));
      } else {
        // Group items by subcategory
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
        
        // Convert to array and sort by item count
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

  const renderVideoItem = ({ item }: { item: SaveItem }) => (
    <TouchableOpacity
      style={styles.videoItem}
      onPress={() => navigation.navigate('VideoDetail', { item })}
      activeOpacity={0.8}
    >
      <View style={styles.thumbnail}>
        {item.thumbnailURL ? (
          <Image source={{ uri: item.thumbnailURL }} style={styles.thumbnailImage} />
        ) : (
          <View style={styles.thumbnailPlaceholder}>
            <Ionicons name="play" size={24} color={Colors.textTertiary} />
          </View>
        )}
        {item.duration && (
          <View style={styles.durationBadge}>
            <Text style={styles.durationText}>
              {Math.floor(item.duration / 60)}:{String(Math.floor(item.duration % 60)).padStart(2, '0')}
            </Text>
          </View>
        )}
      </View>
      
      <View style={styles.videoInfo}>
        <Text style={styles.videoTitle} numberOfLines={2}>
          {getDisplayTitle(item)}
        </Text>
        {item.creatorUsername && (
          <Text style={styles.creatorName}>@{item.creatorUsername}</Text>
        )}
        <View style={styles.metaRow}>
          <Text style={styles.timeAgo}>{formatTimeAgo(item.dateAdded)}</Text>
          {item.detectedTopics.length > 1 && (
            <View style={styles.extraTopics}>
              {item.detectedTopics.slice(1, 3).map(topic => (
                <View key={topic} style={styles.topicBadge}>
                  <Text style={styles.topicText}>{topic}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderSubcategoryItem = ({ item: subcategory }: { item: Subcategory }) => (
    <TouchableOpacity
      style={styles.subcategoryCard}
      onPress={() => navigation.navigate('CategoryDetail', {
        categoryName,
        icon,
        color,
        subcategoryName: subcategory.name,
      })}
      activeOpacity={0.8}
    >
      <View style={[styles.subcategoryIcon, { backgroundColor: `${color}20` }]}>
        <Text style={styles.subcategoryEmoji}>{icon}</Text>
      </View>
      <View style={styles.subcategoryInfo}>
        <Text style={styles.subcategoryName}>{subcategory.name}</Text>
        <Text style={styles.subcategoryCount}>{subcategory.items.length} videos</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={Colors.textQuaternary} />
    </TouchableOpacity>
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Category Header */}
      <View style={styles.header}>
        <View style={[styles.categoryIcon, { backgroundColor: `${color}20` }]}>
          <Text style={styles.categoryEmoji}>{icon}</Text>
        </View>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>
            {subcategoryName ? `${categoryName} > ${subcategoryName}` : categoryName}
          </Text>
          <Text style={styles.headerSubtitle}>
            {subcategoryName 
              ? `${items.length} videos • AI categorized`
              : `${subcategories.length} subcategories • AI categorized`
            }
          </Text>
        </View>
        <View style={styles.aiTag}>
          <Ionicons name="sparkles" size={12} color={Colors.primary} />
          <Text style={styles.aiTagText}>AI</Text>
        </View>
      </View>

      {subcategoryName ? (
        <FlatList
          data={items}
          renderItem={renderVideoItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={Colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No videos in this subcategory</Text>
            </View>
          }
        />
      ) : (
        <FlatList
          data={subcategories}
          renderItem={renderSubcategoryItem}
          keyExtractor={(item) => item.name}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={Colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No subcategories found</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    backgroundColor: Colors.backgroundSecondary,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  categoryIcon: {
    width: 50,
    height: 50,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryEmoji: {
    fontSize: 26,
  },
  headerInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
  },
  headerSubtitle: {
    fontSize: 13,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  aiTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: `${Colors.primary}20`,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
  },
  aiTagText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary,
  },
  listContent: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  videoItem: {
    flexDirection: 'row',
    backgroundColor: Colors.overlayLight,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  thumbnail: {
    width: 120,
    height: 160,
    backgroundColor: Colors.overlay,
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
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
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  durationText: {
    fontSize: 11,
    color: Colors.text,
    fontWeight: '500',
  },
  videoInfo: {
    flex: 1,
    padding: Spacing.md,
    justifyContent: 'center',
  },
  videoTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
    lineHeight: 20,
  },
  creatorName: {
    fontSize: 13,
    color: Colors.textTertiary,
    marginTop: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.sm,
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  timeAgo: {
    fontSize: 12,
    color: Colors.textQuaternary,
  },
  extraTopics: {
    flexDirection: 'row',
    gap: 4,
    marginLeft: Spacing.sm,
  },
  topicBadge: {
    backgroundColor: Colors.overlay,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  topicText: {
    fontSize: 10,
    color: Colors.textSecondary,
  },
  emptyContainer: {
    padding: Spacing.xxl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 15,
    color: Colors.textTertiary,
  },
  subcategoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.overlayLight,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  subcategoryIcon: {
    width: 50,
    height: 50,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  subcategoryEmoji: {
    fontSize: 24,
  },
  subcategoryInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  subcategoryName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  subcategoryCount: {
    fontSize: 13,
    color: Colors.textTertiary,
    marginTop: 2,
  },
});

