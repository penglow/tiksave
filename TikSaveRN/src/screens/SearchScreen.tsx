import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Keyboard,
  Image,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { Spacing, BorderRadius, Typography, Hairline } from '../config';
import { SaveItem, SearchMode, getDisplayTitle } from '../types';
import { apiService, APIError } from '../services/api';
import { useAppStore } from '../stores/appStore';
import { SearchStackScreenProps } from '../navigation/types';
import { useTheme } from '../hooks/useTheme';
import { AnimatedPressable, AnimatedListItem, AnimatedText } from '../components';

type Props = SearchStackScreenProps<'SearchMain'>;

const SUGGESTIONS = [
  'ramen tokyo',
  'hotel room tour',
  'street food',
  'shopping haul',
  'fitness tips',
  'travel vlog',
];

export default function SearchScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [searchText, setSearchText] = useState('');
  const [searchMode, setSearchMode] = useState<SearchMode>('semantic');
  const [results, setResults] = useState<SaveItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const searchIdRef = useRef(0); // Track search requests to handle race conditions

  const { recentSearches, addRecentSearch, clearRecentSearches } = useAppStore();

  // Memoized search function to prevent stale closures
  const performSearch = useCallback(async (query: string, mode: SearchMode, searchId: number) => {
    if (!query.trim()) {
      setResults([]);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const data = await apiService.search(query, mode === 'semantic');
      // Only update results if this is still the latest search
      if (searchId === searchIdRef.current) {
        setResults(data);
      }
    } catch (err) {
      console.error('Search failed:', err);
      // Only update error if this is still the latest search
      if (searchId === searchIdRef.current) {
        if (err instanceof APIError) {
          setError(err.message);
        } else {
          setError('Search failed. Please try again.');
        }
        setResults([]);
      }
    } finally {
      if (searchId === searchIdRef.current) {
        setIsLoading(false);
        setIsTyping(false);
      }
    }
  }, []);

  const handleSearch = useCallback(async (query?: string) => {
    const searchQuery = query || searchText;
    if (!searchQuery.trim()) return;

    Keyboard.dismiss();
    searchIdRef.current += 1;
    const currentSearchId = searchIdRef.current;
    // Immediate search on submit
    await performSearch(searchQuery, searchMode, currentSearchId);
    addRecentSearch(searchQuery);
  }, [searchText, searchMode, performSearch, addRecentSearch]);

  // Debounced search effect with proper cleanup
  useEffect(() => {
    let isMounted = true;
    
    // Show typing indicator immediately
    if (searchText.trim()) {
      setIsTyping(true);
    }

    const timer = setTimeout(() => {
      if (!isMounted) return;
      
      searchIdRef.current += 1;
      const currentSearchId = searchIdRef.current;
      
      if (searchText.trim()) {
        performSearch(searchText, searchMode, currentSearchId);
      } else {
        setResults([]);
        setError(null);
        setIsTyping(false);
      }
    }, 300); // Reduced from 500ms for better responsiveness

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [searchText, searchMode, performSearch]);

  const handleClear = useCallback(() => {
    setSearchText('');
    setResults([]);
    setError(null);
    setIsTyping(false);
  }, []);

  const handleModeChange = useCallback((mode: SearchMode) => {
    setSearchMode(mode);
    setError(null);
    // Effect will trigger search
  }, []);

  const showInitialState = !searchText && results.length === 0 && !isLoading && !error;
  const showNoResults = searchText && results.length === 0 && !isLoading && !error;
  const showError = error && !isLoading;

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <AnimatedText style={[styles.headerTitle, { color: colors.text }]}>Search</AnimatedText>
      </View>

      {/* Search Bar */}
      <View style={styles.searchBarContainer}>
        <View style={[styles.searchInputContainer, { borderColor: colors.border }]}>
          {isLoading ? (
            <ActivityIndicator size="small" color={colors.textQuaternary} />
          ) : isTyping ? (
            <View style={styles.typingIndicator}>
              <View style={[styles.typingDot, { backgroundColor: colors.textQuaternary }]} />
            </View>
          ) : (
            <Ionicons name="search" size={16} color={colors.textQuaternary} />
          )}
          <TextInput
            ref={inputRef}
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search videos..."
            placeholderTextColor={colors.textQuaternary}
            value={searchText}
            onChangeText={setSearchText}
            onSubmitEditing={() => handleSearch()}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setIsSearchFocused(false)}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel="Search videos"
            accessibilityHint="Enter keywords to search your saved videos"
          />
          {searchText.length > 0 && (
            <AnimatedPressable 
              onPress={handleClear}
              accessibilityLabel="Clear search"
              accessibilityRole="button"
            >
              <Ionicons name="close-circle" size={16} color={colors.textQuaternary} />
            </AnimatedPressable>
          )}
        </View>

        {isSearchFocused && (
          <AnimatedPressable
            style={styles.cancelButton}
            onPress={() => {
              Keyboard.dismiss();
              handleClear();
            }}
            accessibilityLabel="Cancel search"
            accessibilityRole="button"
          >
            <Text style={[styles.cancelButtonText, { color: colors.textSecondary }]}>
              Cancel
            </Text>
          </AnimatedPressable>
        )}
      </View>

      {/* Search Mode Toggle */}
      {(searchText.length > 0 || results.length > 0) && (
        <View style={[styles.modeToggle, { borderBottomColor: colors.border }]}>
          {(['semantic', 'keyword'] as SearchMode[]).map((mode) => (
            <AnimatedPressable
              key={mode}
              style={styles.modeButton}
              onPress={() => handleModeChange(mode)}
            >
              <Text style={[
                styles.modeButtonText,
                { color: searchMode === mode ? colors.text : colors.textTertiary },
              ]}>
                {mode === 'semantic' ? 'Semantic' : 'Keyword'}
              </Text>
              {searchMode === mode && (
                <View style={[styles.modeIndicator, { backgroundColor: colors.text }]} />
              )}
            </AnimatedPressable>
          ))}
        </View>
      )}

      {/* Content */}
      {isLoading && results.length === 0 ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="small" color={colors.text} />
          <Text style={[styles.loadingText, { color: colors.textTertiary }]}>
            {searchMode === 'semantic' ? 'Understanding your query...' : 'Searching...'}
          </Text>
        </View>
      ) : showError ? (
        <View style={styles.centerContainer}>
          <Ionicons name="cloud-offline-outline" size={32} color={colors.error} />
          <AnimatedText delay={100} style={[styles.errorTitle, { color: colors.text }]}>
            Search failed
          </AnimatedText>
          <AnimatedText delay={200} style={[styles.errorSubtitle, { color: colors.textTertiary }]}>
            {error}
          </AnimatedText>
          <AnimatedPressable
            style={[styles.retryButton, { borderColor: colors.border }]}
            onPress={() => handleSearch()}
            accessibilityLabel="Retry search"
            accessibilityRole="button"
          >
            <Ionicons name="refresh" size={16} color={colors.text} />
            <Text style={[styles.retryButtonText, { color: colors.text }]}>Retry</Text>
          </AnimatedPressable>
        </View>
      ) : showInitialState ? (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Recent Searches */}
          {recentSearches.length > 0 && (
            <AnimatedListItem index={0} direction="fade">
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>
                    RECENT
                  </Text>
                  <AnimatedPressable onPress={clearRecentSearches}>
                    <Text style={[styles.clearButton, { color: colors.textQuaternary }]}>
                      Clear
                    </Text>
                  </AnimatedPressable>
                </View>
                {recentSearches.map((query, index) => (
                  <AnimatedPressable
                    key={query}
                    style={[styles.recentItem, { borderBottomColor: colors.border }]}
                    onPress={() => {
                      setSearchText(query);
                      handleSearch(query);
                    }}
                  >
                    <Ionicons name="time-outline" size={14} color={colors.textQuaternary} />
                    <Text style={[styles.recentText, { color: colors.text }]}>{query}</Text>
                    <Ionicons name="arrow-forward" size={14} color={colors.textQuaternary} />
                  </AnimatedPressable>
                ))}
              </View>
            </AnimatedListItem>
          )}

          {/* Suggestions */}
          <AnimatedListItem index={1} direction="fade">
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>
                TRY SEARCHING
              </Text>
              <View style={styles.suggestionsContainer}>
                {SUGGESTIONS.map((suggestion) => (
                  <AnimatedPressable
                    key={suggestion}
                    style={[styles.suggestionBadge, { borderColor: colors.border }]}
                    onPress={() => {
                      setSearchText(suggestion);
                      handleSearch(suggestion);
                    }}
                  >
                    <Text style={[styles.suggestionText, { color: colors.text }]}>
                      {suggestion}
                    </Text>
                  </AnimatedPressable>
                ))}
              </View>
            </View>
          </AnimatedListItem>
        </ScrollView>
      ) : showNoResults ? (
        <View style={styles.centerContainer}>
          <Ionicons name="search-outline" size={32} color={colors.textQuaternary} />
          <AnimatedText delay={100} style={[styles.noResultsTitle, { color: colors.text }]}>
            No results
          </AnimatedText>
          <AnimatedText delay={200} style={[styles.noResultsSubtitle, { color: colors.textTertiary }]}>
            Try different keywords
          </AnimatedText>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.resultsContent}
          showsVerticalScrollIndicator={false}
        >
          {results.map((item, index) => (
            <AnimatedListItem key={item.id} index={index} direction="fade">
              <SearchResultRow
                item={item}
                searchQuery={searchText}
                onNavigateToDetail={() => navigation.navigate('VideoDetail', { item })}
              />
            </AnimatedListItem>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function SearchResultRow({
  item,
  searchQuery,
  onNavigateToDetail,
}: {
  item: SaveItem;
  searchQuery: string;
  onNavigateToDetail: () => void;
}) {
  const { colors } = useTheme();

  const findMatchContext = (): string | null => {
    if (!item.transcriptText) return null;
    const words = searchQuery.toLowerCase().split(' ');
    const transcriptLower = item.transcriptText.toLowerCase();

    for (const word of words) {
      const index = transcriptLower.indexOf(word);
      if (index !== -1) {
        const start = Math.max(0, index - 30);
        const end = Math.min(item.transcriptText.length, index + word.length + 50);
        let context = item.transcriptText.substring(start, end);
        if (start > 0) context = '...' + context;
        if (end < item.transcriptText.length) context = context + '...';
        return context;
      }
    }
    return null;
  };

  const matchContext = findMatchContext();

  const openInTikTok = () => {
    if (item.sourceURL) {
      Linking.openURL(item.sourceURL);
    }
  };

  return (
    <AnimatedPressable
      style={[styles.resultRow, { borderBottomColor: colors.border }]}
      onPress={onNavigateToDetail}
    >
      {/* Thumbnail */}
      <AnimatedPressable
        style={styles.resultThumbnail}
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
            <Ionicons name="play" size={16} color={colors.textTertiary} />
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
      <View style={styles.resultInfo}>
        <Text style={[styles.resultTitle, { color: colors.text }]} numberOfLines={2}>
          {getDisplayTitle(item)}
        </Text>

        {item.creatorUsername && (
          <Text style={[styles.resultCreator, { color: colors.textTertiary }]}>
            @{item.creatorUsername}
          </Text>
        )}

        {matchContext && (
          <Text style={[styles.matchContext, { color: colors.textQuaternary }]} numberOfLines={1}>
            {matchContext}
          </Text>
        )}

        {item.detectedTopics.length > 0 && (
          <View style={styles.topicsRow}>
            {item.detectedTopics.slice(0, 2).map((topic) => (
              <Text key={topic} style={[styles.topicText, { color: colors.textQuaternary }]}>
                {topic}
              </Text>
            ))}
          </View>
        )}
      </View>

      <Ionicons name="chevron-forward" size={14} color={colors.textQuaternary} />
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  headerTitle: {
    ...Typography.displayMd,
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
    gap: Spacing.sm,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm,
    gap: Spacing.xs,
  },
  searchInput: {
    flex: 1,
    paddingVertical: Spacing.sm,
    ...Typography.body,
  },
  cancelButton: {
    paddingVertical: Spacing.xs,
  },
  cancelButtonText: {
    ...Typography.body,
  },
  modeToggle: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    borderBottomWidth: Hairline,
  },
  modeButton: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    marginRight: Spacing.lg,
  },
  modeButtonText: {
    ...Typography.captionStrong,
  },
  modeIndicator: {
    height: 2,
    width: '100%',
    marginTop: Spacing.xs,
    borderRadius: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  loadingText: {
    ...Typography.caption,
    marginTop: Spacing.sm,
  },
  typingIndicator: {
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    opacity: 0.6,
  },
  errorTitle: {
    ...Typography.headingSm,
    marginTop: Spacing.md,
  },
  errorSubtitle: {
    ...Typography.caption,
    marginTop: Spacing.xs,
    textAlign: 'center',
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.lg,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
  },
  retryButtonText: {
    ...Typography.captionStrong,
  },
  noResultsTitle: {
    ...Typography.headingSm,
    marginTop: Spacing.md,
  },
  noResultsSubtitle: {
    ...Typography.caption,
    marginTop: Spacing.xs,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.md,
    gap: Spacing.lg,
  },
  resultsContent: {
    paddingBottom: Spacing.xl,
  },
  section: {
    gap: Spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionLabel: {
    ...Typography.label,
  },
  clearButton: {
    ...Typography.caption,
  },
  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderBottomWidth: Hairline,
  },
  recentText: {
    ...Typography.body,
    flex: 1,
  },
  suggestionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  suggestionBadge: {
    borderWidth: 1,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  suggestionText: {
    ...Typography.caption,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: Hairline,
  },
  resultThumbnail: {
    width: 60,
    height: 80,
    borderRadius: BorderRadius.xs,
    overflow: 'hidden',
  },
  thumbnailImage: {
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
  resultInfo: {
    flex: 1,
    gap: 2,
  },
  resultTitle: {
    ...Typography.captionStrong,
    lineHeight: 16,
  },
  resultCreator: {
    fontSize: 12,
  },
  matchContext: {
    fontSize: 11,
  },
  topicsRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    marginTop: 2,
  },
  topicText: {
    fontSize: 10,
  },
});
