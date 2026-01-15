import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

import { Colors, Spacing, BorderRadius } from '../config';
import { SaveItem, getDisplayTitle } from '../types';
import { apiService } from '../services/api';
import { LibraryStackScreenProps } from '../navigation/types';
import { formatTimeAgo } from '../utils/date';

type Props = LibraryStackScreenProps<'LibraryMain'>;

// AI Category with auto-detected icon and color
interface AICategory {
  name: string;
  icon: string;
  items: SaveItem[];
  color: string;
  subcategories?: { name: string; items: SaveItem[] }[];
}

const CATEGORY_CONFIG: Record<string, { icon: string; color: string }> = {
  food: { icon: '🍜', color: '#F97316' },
  travel: { icon: '✈️', color: '#06B6D4' },
  fitness: { icon: '💪', color: '#22C55E' },
  fashion: { icon: '👗', color: '#EC4899' },
  beauty: { icon: '💄', color: '#F472B6' },
  tech: { icon: '📱', color: '#8B5CF6' },
  finance: { icon: '💰', color: '#10B981' },
  comedy: { icon: '😂', color: '#FBBF24' },
  music: { icon: '🎵', color: '#EF4444' },
  dance: { icon: '💃', color: '#A855F7' },
  pets: { icon: '🐾', color: '#F59E0B' },
  diy: { icon: '🔨', color: '#6366F1' },
  education: { icon: '📚', color: '#14B8A6' },
  gaming: { icon: '🎮', color: '#7C3AED' },
  sports: { icon: '⚽', color: '#059669' },
  art: { icon: '🎨', color: '#DB2777' },
  nature: { icon: '🌿', color: '#16A34A' },
  lifestyle: { icon: '✨', color: '#D946EF' },
  news: { icon: '📰', color: '#64748B' },
  shopping: { icon: '🛍️', color: '#F43F5E' },
  uncategorized: { icon: '📁', color: '#6B7280' },
};

function getCategoryConfig(topic: string): { icon: string; color: string } {
  const lower = topic.toLowerCase();
  
  // Check for exact matches first
  if (CATEGORY_CONFIG[lower]) return CATEGORY_CONFIG[lower];
  
  // Check for partial matches
  for (const [key, config] of Object.entries(CATEGORY_CONFIG)) {
    if (lower.includes(key) || key.includes(lower)) return config;
  }
  
  // Food related
  if (['recipe', 'cooking', 'restaurant', 'eating', 'cafe', 'ramen', 'sushi'].some(w => lower.includes(w))) {
    return CATEGORY_CONFIG.food;
  }
  
  // Travel related
  if (['japan', 'korea', 'hotel', 'trip', 'vacation', 'explore', 'destination'].some(w => lower.includes(w))) {
    return CATEGORY_CONFIG.travel;
  }
  
  // Fitness related
  if (['workout', 'gym', 'exercise', 'training', 'health'].some(w => lower.includes(w))) {
    return CATEGORY_CONFIG.fitness;
  }
  
  return CATEGORY_CONFIG.uncategorized;
}

export default function LibraryScreen({ navigation }: Props) {
  const [items, setItems] = useState<SaveItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadItems = useCallback(async () => {
    console.log('🔄 Loading items...');
    try {
      const allItems = await apiService.getItems();
      const readyItems = allItems.filter(item => item.status === 'ready');
      
      // Debug: Check thumbnails
      const withThumbnails = readyItems.filter(item => item.thumbnailURL);
      console.log('📦 Got items:', readyItems.length, 'total');
      console.log('📷 Items with thumbnails:', withThumbnails.length);
      if (withThumbnails.length > 0) {
        console.log('📷 Sample thumbnail URL:', withThumbnails[0].thumbnailURL?.substring(0, 100));
      }
      
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

  // Group items by AI-detected topics (supports "Parent > Subcategory" format)
  const categories = useMemo(() => {
    // First, group by parent category
    const parentMap = new Map<string, {
      items: SaveItem[];
      subcategories: Map<string, SaveItem[]>;
    }>();
    
    for (const item of items) {
      const primaryTopic = item.detectedTopics?.[0] || 'Saved';
      
      // Parse hierarchical category (e.g., "Food > Japanese Street Food")
      let parentName = primaryTopic;
      let subName: string | null = null;
      
      if (primaryTopic.includes(' > ')) {
        const parts = primaryTopic.split(' > ');
        parentName = parts[0].trim();
        subName = parts[1]?.trim() || null;
      }
      
      // Normalize parent name
      parentName = parentName.charAt(0).toUpperCase() + parentName.slice(1);
      
      if (!parentMap.has(parentName)) {
        parentMap.set(parentName, { items: [], subcategories: new Map() });
      }
      
      const parent = parentMap.get(parentName)!;
      parent.items.push(item);
      
      // Add to subcategory if exists
      if (subName) {
        if (!parent.subcategories.has(subName)) {
          parent.subcategories.set(subName, []);
        }
        parent.subcategories.get(subName)!.push(item);
      }
    }
    
    // Convert to array
    const result: AICategory[] = [];
    for (const [name, data] of parentMap) {
      const config = getCategoryConfig(name);
      
      // Build subcategories array
      const subcategories: { name: string; items: SaveItem[] }[] = [];
      for (const [subName, subItems] of data.subcategories) {
        subcategories.push({
          name: subName,
          items: subItems.sort((a, b) => 
            new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime()
          ),
        });
      }
      
      result.push({
        name,
        icon: config.icon,
        color: config.color,
        items: data.items.sort((a, b) => 
          new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime()
        ),
        subcategories: subcategories.sort((a, b) => b.items.length - a.items.length),
      });
    }
    
    return result.sort((a, b) => b.items.length - a.items.length);
  }, [items]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading your library...</Text>
      </View>
    );
  }

  if (items.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <LinearGradient
          colors={[`${Colors.primary}30`, `${Colors.secondary}30`]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.emptyIconContainer}
        >
          <Text style={styles.emptyIcon}>🤖</Text>
        </LinearGradient>
        <Text style={styles.emptyTitle}>Your AI Library is Empty</Text>
        <Text style={styles.emptySubtitle}>
          Import TikTok videos and watch as AI{'\n'}automatically organizes them into categories
        </Text>
        <TouchableOpacity
          style={styles.importButton}
          onPress={() => navigation.navigate('AddVideo')}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={[Colors.primary, Colors.secondary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.importButtonGradient}
          >
            <Ionicons name="add-circle" size={20} color={Colors.text} />
            <Text style={styles.importButtonText}>Import TikToks</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header Stats */}
      <View style={styles.statsBar}>
        <View style={styles.stat}>
          <Text style={styles.statNumber}>{items.length}</Text>
          <Text style={styles.statLabel}>Videos</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statNumber}>{categories.length}</Text>
          <Text style={styles.statLabel}>AI Categories</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statNumber}>🤖</Text>
          <Text style={styles.statLabel}>Auto-sorted</Text>
        </View>
      </View>

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
        {/* AI Categories */}
        {categories.map((category) => (
          <CategorySection
            key={category.name}
            category={category}
            onPressItem={(item) => navigation.navigate('VideoDetail', { item })}
            onPressCategory={() => navigation.navigate('CategoryDetail', { 
              categoryName: category.name,
              icon: category.icon,
              color: category.color,
            })}
            onPressSubcategory={(subcategoryName) => navigation.navigate('CategoryDetail', {
              categoryName: category.name,
              icon: category.icon,
              color: category.color,
              subcategoryName: subcategoryName,
            })}
          />
        ))}
      </ScrollView>
    </View>
  );
}

// Category Section Component
function CategorySection({
  category,
  onPressItem,
  onPressCategory,
  onPressSubcategory,
}: {
  category: AICategory;
  onPressItem: (item: SaveItem) => void;
  onPressCategory: () => void;
  onPressSubcategory: (subcategoryName: string) => void;
}) {
  const hasSubcategories = category.subcategories && category.subcategories.length > 0;
  
  return (
    <View style={styles.categorySection}>
      {/* Category Header */}
      <TouchableOpacity 
        style={styles.categoryHeader}
        onPress={onPressCategory}
        activeOpacity={0.7}
      >
        <View style={[styles.categoryIcon, { backgroundColor: `${category.color}20` }]}>
          <Text style={styles.categoryEmoji}>{category.icon}</Text>
        </View>
        <View style={styles.categoryInfo}>
          <Text style={styles.categoryName}>{category.name}</Text>
          <Text style={styles.categoryCount}>
            {category.items.length} videos
            {hasSubcategories && ` · ${category.subcategories!.length} subcategories`}
          </Text>
        </View>
        <View style={styles.aiTag}>
          <Ionicons name="sparkles" size={10} color={Colors.primary} />
          <Text style={styles.aiTagText}>AI</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={Colors.textQuaternary} />
      </TouchableOpacity>

      {/* Subcategory Tags */}
      {hasSubcategories && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.subcategoryScroll}
        >
          {category.subcategories!.map((sub) => (
            <TouchableOpacity
              key={sub.name}
              style={[styles.subcategoryTag, { backgroundColor: `${category.color}15` }]}
              onPress={() => onPressSubcategory(sub.name)}
              activeOpacity={0.7}
            >
              <Text style={[styles.subcategoryText, { color: category.color }]}>
                {sub.name}
              </Text>
              <Text style={styles.subcategoryCount}>{sub.items.length}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Horizontal Video Scroll */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.videoScroll}
      >
        {category.items.slice(0, 6).map((item) => {
          const openInTikTok = () => {
            if (item.sourceURL) {
              Linking.openURL(item.sourceURL);
            }
          };

          return (
            <View key={item.id} style={styles.videoCard}>
              {/* Thumbnail with Open in TikTok overlay */}
              <TouchableOpacity
                style={styles.videoThumbnail}
                onPress={openInTikTok}
                activeOpacity={0.8}
              >
                {item.thumbnailURL ? (
                  <Image 
                    source={{ 
                      uri: item.thumbnailURL,
                      cache: 'force-cache'
                    }} 
                    style={styles.thumbnailImage}
                    onError={(e) => {
                      console.warn('❌ Failed to load thumbnail:', item.thumbnailURL?.substring(0, 80));
                    }}
                    onLoad={() => {
                      console.log('✅ Thumbnail loaded');
                    }}
                    resizeMode="cover"
                  />
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
              </TouchableOpacity>
              
              {/* Title and Creator - clickable to navigate to video details */}
              <TouchableOpacity
                onPress={() => onPressItem(item)}
                activeOpacity={0.7}
              >
                <Text style={styles.videoTitle} numberOfLines={2}>
                  {getDisplayTitle(item)}
                </Text>
                {item.creatorUsername && (
                  <Text style={styles.creatorName}>@{item.creatorUsername}</Text>
                )}
              </TouchableOpacity>
            </View>
          );
        })}
        
        {/* See All Card */}
        {category.items.length > 6 && (
          <TouchableOpacity
            style={styles.seeAllCard}
            onPress={onPressCategory}
            activeOpacity={0.8}
          >
            <View style={[styles.seeAllCircle, { backgroundColor: `${category.color}30` }]}>
              <Text style={styles.seeAllCount}>+{category.items.length - 6}</Text>
            </View>
            <Text style={styles.seeAllText}>See All</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
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
    paddingBottom: Spacing.xxl,
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
    width: 140,
    height: 140,
    borderRadius: 70,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.xxl,
  },
  emptyIcon: {
    fontSize: 60,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 15,
    color: Colors.textTertiary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.xxl,
  },
  importButton: {
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  importButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xxl,
  },
  importButtonText: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  statsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    backgroundColor: Colors.backgroundSecondary,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  stat: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
  },
  statLabel: {
    fontSize: 11,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: Colors.border,
  },
  categorySection: {
    marginTop: Spacing.xl,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  categoryIcon: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryEmoji: {
    fontSize: 22,
  },
  categoryInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  categoryName: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
  },
  categoryCount: {
    fontSize: 13,
    color: Colors.textTertiary,
  },
  subcategoryScroll: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    gap: Spacing.sm,
  },
  subcategoryTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    marginRight: Spacing.sm,
  },
  subcategoryText: {
    fontSize: 13,
    fontWeight: '500',
  },
  subcategoryCount: {
    fontSize: 11,
    color: Colors.textTertiary,
    marginLeft: Spacing.xs,
  },
  aiTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: `${Colors.primary}20`,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    marginRight: Spacing.sm,
  },
  aiTagText: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.primary,
  },
  videoScroll: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  videoCard: {
    width: 140,
    marginRight: Spacing.md,
  },
  videoThumbnail: {
    width: 140,
    height: 180,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.overlay,
    overflow: 'hidden',
    position: 'relative',
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
    zIndex: 1,
  },
  durationText: {
    fontSize: 11,
    color: Colors.text,
    fontWeight: '500',
  },
  videoTitle: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.text,
    marginTop: Spacing.sm,
    lineHeight: 18,
  },
  creatorName: {
    fontSize: 11,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  seeAllCard: {
    width: 100,
    height: 180,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.overlayLight,
    marginRight: Spacing.lg,
  },
  seeAllCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  seeAllCount: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  seeAllText: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: Spacing.sm,
  },
});

