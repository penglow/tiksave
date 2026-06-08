/**
 * SearchScreen
 *
 * Semantic and keyword search across saved videos in the Search tab. Debounces input,
 * shows recent searches and suggestions, and navigates to `VideoDetail` from results.
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
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
  TextStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Spacing, BorderRadius, Typography, Gradients, Hairline, TAB_BAR_OVERLAP } from '../config';
import { LinearGradient } from 'expo-linear-gradient';
import { SaveItem, SearchMode, getDisplayTitle } from '../types';
import { apiService, APIError } from '../services/api';
import { useAppStore } from '../stores/appStore';
import { SearchStackScreenProps } from '../navigation/types';
import { useTheme } from '../hooks/useTheme';
import { useResolvedTikTokThumbnail } from '../hooks/useResolvedTikTokThumbnail';
import {
  AnimatedPressable,
  AnimatedListItem,
  AnimatedText,
  Badge,
  RotatingLogo,
  ScreenBackground,
  ScreenHeader,
  GlassSearchBar,
  FilterChipsRow,
  GlassSurface,
} from '../components';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type Props = SearchStackScreenProps<'SearchMain'>;

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const SUGGESTIONS = [
  'ramen tokyo',
  'hotel room tour',
  'street food',
  'shopping haul',
  'fitness tips',
  'travel vlog',
];

// -----------------------------------------------------------------------------
// Main screen
// -----------------------------------------------------------------------------

export default function SearchScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  // --- Search state -----------------------------------------------------------

  const [searchText, setSearchText] = useState('');
  const [searchMode, setSearchMode] = useState<SearchMode>('semantic');
  const [searchChip, setSearchChip] = useState('all');
  const [results, setResults] = useState<SaveItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const searchIdRef = useRef(0);

  const { recentSearches, addRecentSearch, clearRecentSearches } = useAppStore();

  // --- Data loading -----------------------------------------------------------

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
      if (searchId === searchIdRef.current) {
        setResults(data);
      }
    } catch (err) {
      console.error('Search failed:', err);
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

  const handleSearch = useCallback(
    async (query?: string) => {
      const searchQuery = query || searchText;
      if (!searchQuery.trim()) return;

      Keyboard.dismiss();
      searchIdRef.current += 1;
      const currentSearchId = searchIdRef.current;
      await performSearch(searchQuery, searchMode, currentSearchId);
      addRecentSearch(searchQuery);
    },
    [searchText, searchMode, performSearch, addRecentSearch],
  );

  useEffect(() => {
    let isMounted = true;

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
    }, 300);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [searchText, searchMode, performSearch]);

  // --- Handlers ---------------------------------------------------------------

  const handleClear = useCallback(() => {
    setSearchText('');
    setResults([]);
    setError(null);
    setIsTyping(false);
  }, []);

  const handleModeChange = useCallback((mode: SearchMode) => {
    setSearchMode(mode);
    setError(null);
  }, []);

  // --- Derived ----------------------------------------------------------------

  const showInitialState = !searchText && results.length === 0 && !isLoading && !error;
  const showNoResults = searchText && results.length === 0 && !isLoading && !error;
  const showError = error && !isLoading;

  const searchChips = useMemo(
    () => [
      { id: 'all', label: 'All' },
      { id: 'semantic', label: 'Semantic' },
      { id: 'keyword', label: 'Keyword' },
    ],
    [],
  );

  const onSearchChip = useCallback(
    (id: string) => {
      setSearchChip(id);
      if (id === 'semantic' || id === 'keyword') {
        handleModeChange(id as SearchMode);
      } else {
        handleModeChange('semantic');
      }
    },
    [handleModeChange],
  );

  // --- Render -----------------------------------------------------------------

  return (
    <ScreenBackground>
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <ScreenHeader title="Search" subtitle="Find anything in your saved videos" />
        <GlassSearchBar
          value={searchText}
          onChangeText={setSearchText}
          placeholder="tokyo food spots"
          onSubmitEditing={() => handleSearch()}
          onFocus={() => setIsSearchFocused(true)}
          onBlur={() => setIsSearchFocused(false)}
          onFilterPress={() => handleClear()}
          filterAccessibilityLabel="Clear search"
        />
        <FilterChipsRow options={searchChips} selectedId={searchChip} onSelect={onSearchChip} />

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
          <View style={[styles.emptyIconWrapper, { backgroundColor: colors.errorSubtle }]}>
            <Ionicons name="cloud-offline-outline" size={28} color={colors.error} />
          </View>
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
          {recentSearches.length > 0 && (
            <View style={styles.recentHeader}>
              <Text style={[styles.recentTitle, { color: colors.text }]}>Recent searches</Text>
              <Text style={[styles.sortLabel, { color: colors.textSecondary }]}>Sort: Relevance</Text>
            </View>
          )}
          {recentSearches.length > 0 && (
            <View style={styles.recentPills}>
              {recentSearches.map((query) => (
                <AnimatedPressable
                  key={query}
                  style={[styles.recentPill, { backgroundColor: colors.glassStrong, borderColor: colors.glassBorder }]}
                  onPress={() => {
                    setSearchText(query);
                    handleSearch(query);
                  }}
                >
                  <Ionicons name="time-outline" size={12} color={colors.textTertiary} />
                  <Text style={[styles.recentPillText, { color: colors.text }]}>{query}</Text>
                </AnimatedPressable>
              ))}
              <AnimatedPressable onPress={clearRecentSearches}>
                <Text style={[styles.clearLink, { color: colors.textTertiary }]}>Clear</Text>
              </AnimatedPressable>
            </View>
          )}

          <LinearGradient colors={Gradients.smartCard} style={styles.smartCardGradient}>
            <GlassSurface borderRadius="lg" padding="md" border={false}>
              <View style={styles.smartSearchRow}>
                <View style={[styles.smartSearchIcon, { backgroundColor: colors.accentSubtle }]}>
                  <Ionicons name="sparkles" size={22} color={colors.text} />
                </View>
                <View style={styles.smartSearchText}>
                  <Text style={[styles.smartSearchTitle, { color: colors.text }]}>Smart Search</Text>
                  <Text style={[styles.smartSearchDesc, { color: colors.textSecondary }]}>
                    Semantic search scans titles, transcript text, labels, folders, and creators.
                  </Text>
                </View>
              </View>
              <View style={styles.tryRow}>
                {SUGGESTIONS.slice(0, 2).map((suggestion) => (
                  <AnimatedPressable
                    key={suggestion}
                    style={[styles.tryPill, { backgroundColor: colors.glassStrong }]}
                    onPress={() => {
                      setSearchText(suggestion);
                      handleSearch(suggestion);
                    }}
                  >
                    <Text style={[styles.tryPillText, { color: colors.text }]}>
                      Try: &quot;{suggestion}&quot;
                    </Text>
                  </AnimatedPressable>
                ))}
              </View>
            </GlassSurface>
          </LinearGradient>
        </ScrollView>
      ) : showNoResults ? (
        <View style={styles.centerContainer}>
          <View style={[styles.emptyIconWrapper, { backgroundColor: colors.surfaceHover }]}>
            <Ionicons name="search-outline" size={28} color={colors.textTertiary} />
          </View>
          <AnimatedText delay={100} style={[styles.noResultsTitle, { color: colors.text }]}>
            No results
          </AnimatedText>
          <AnimatedText
            delay={200}
            style={[styles.noResultsSubtitle, { color: colors.textTertiary }]}
          >
            Try different keywords
          </AnimatedText>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.resultsContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={[styles.resultsHeading, { color: colors.text }]}>Top Results</Text>
          {results.map((item, index) => (
            <AnimatedListItem key={item.id} index={index} direction="fade" disableExitAnimation>
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
    </ScreenBackground>
  );
}

// -----------------------------------------------------------------------------
// Subcomponents — search result row
// -----------------------------------------------------------------------------

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

  const thumbUri = useResolvedTikTokThumbnail(item.sourceURL, item.thumbnailURL);

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

  const conf = item.confidence != null ? Math.round(item.confidence * 100) : null;

  return (
    <View
      style={[
        styles.resultRow,
        { backgroundColor: colors.glassStrong, borderColor: colors.glassBorder },
      ]}
    >
      <AnimatedPressable style={styles.resultThumbnail} onPress={openInTikTok} scaleOnPress={0.97}>
        {thumbUri ? (
          <Image
            source={{ uri: thumbUri, cache: 'force-cache' }}
            style={styles.thumbnailImage}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.thumbnailPlaceholder, { backgroundColor: colors.surfaceHover }]}>
            <Ionicons name="play" size={16} color={colors.textTertiary} />
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
        style={styles.resultMain}
        onPress={onNavigateToDetail}
        noScale
        opacityOnPress={0.6}
        accessibilityLabel={`View details for ${getDisplayTitle(item)}`}
        accessibilityRole="button"
      >
        <View style={styles.resultInfo}>
          <Text style={[styles.resultTitle, { color: colors.text }]} numberOfLines={2}>
            {getDisplayTitle(item)}
          </Text>

          {item.creatorUsername ? (
            <Text style={[styles.resultCreator, { color: colors.textTertiary }]}>
              @{item.creatorUsername}
            </Text>
          ) : null}

          <View style={styles.matchRow}>
            <Ionicons name="sparkles-outline" size={11} color={colors.textTertiary} />
            <Text style={[styles.matchLabel, { color: colors.textTertiary }]}>
              {matchContext ? 'Transcript match' : 'Semantic match'}
            </Text>
          </View>

          {(item.detectedTopics ?? []).length > 0 ? (
            <View style={styles.topicsRow}>
              {(item.detectedTopics ?? []).slice(0, 1).map((topic) => (
                <Badge key={topic} label={topic.split(' > ')[0]} variant="ghost" size="sm" />
              ))}
            </View>
          ) : null}
        </View>
      </AnimatedPressable>

      <View style={styles.resultActions}>
        <Ionicons name="bookmark-outline" size={18} color={colors.textTertiary} />
        {conf != null ? (
          <Text style={[styles.confidence, { color: colors.success }]}>{conf}% confidence</Text>
        ) : null}
        <AnimatedPressable onPress={onNavigateToDetail} noScale accessibilityLabel="More options">
          <Ionicons name="ellipsis-horizontal" size={18} color={colors.textTertiary} />
        </AnimatedPressable>
      </View>
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
  header: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
    gap: Spacing.xs,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  brandLabel: {
    ...Typography.label,
    fontSize: 10,
    letterSpacing: 1.6,
  },
  headerTitle: {
    ...Typography.displayMd,
    fontSize: 32,
    lineHeight: 36,
  },
  headerTitleAccent: {
    ...Typography.displayMd,
    fontSize: 32,
    lineHeight: 36,
    fontStyle: 'italic',
  },
  headerSub: {
    ...Typography.caption,
    marginTop: Spacing.xs,
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
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
    height: 48,
  },
  searchInput: {
    flex: 1,
    ...Typography.body,
    paddingVertical: 0,
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
    gap: Spacing.lg,
  },
  modeButton: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
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
  emptyIconWrapper: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
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
    minHeight: 0,
  },
  scrollContent: {
    paddingHorizontal: Spacing.screen,
    paddingBottom: Spacing.md + TAB_BAR_OVERLAP,
    gap: Spacing.lg,
  },
  resultsContent: {
    paddingBottom: Spacing.xl + TAB_BAR_OVERLAP,
  },
  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  recentTitle: {
    ...Typography.headingSm,
    fontWeight: '700',
  },
  sortLabel: {
    ...Typography.caption,
    fontSize: 13,
  },
  recentPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
    alignItems: 'center',
  },
  recentPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  recentPillText: {
    ...Typography.captionStrong,
    fontSize: 13,
  },
  clearLink: {
    ...Typography.caption,
    marginLeft: Spacing.xs,
  },
  smartCardGradient: {
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    marginBottom: Spacing.lg,
  },
  smartSearchRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  smartSearchIcon: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smartSearchText: {
    flex: 1,
    gap: 4,
  },
  smartSearchTitle: {
    ...Typography.bodyStrong,
    fontSize: 16,
  },
  smartSearchDesc: {
    ...Typography.caption,
    fontSize: 12,
    lineHeight: 17,
  },
  tryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  tryPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
  },
  tryPillText: {
    ...Typography.caption,
    fontSize: 12,
  },
  resultsHeading: {
    ...Typography.headingSm,
    fontWeight: '700',
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.screen,
  },
  section: {
    gap: Spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  sectionLabelDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
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
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderBottomWidth: Hairline,
    borderRadius: BorderRadius.sm,
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
    paddingHorizontal: Spacing.md,
    paddingVertical: 9,
    borderRadius: BorderRadius.full,
  },
  suggestionText: {
    ...Typography.caption,
    fontWeight: '500',
    fontSize: 13,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.sm,
    marginHorizontal: Spacing.screen,
    marginBottom: Spacing.sm,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  matchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  matchLabel: {
    fontSize: 11,
  },
  resultActions: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
    minWidth: 56,
  },
  confidence: {
    fontSize: 11,
    fontWeight: '600',
  },
  resultThumbnail: {
    width: 64,
    height: 86,
    borderRadius: BorderRadius.sm,
    overflow: 'hidden',
    backgroundColor: '#000',
    borderWidth: 1,
    borderColor: 'rgba(128, 128, 128, 0.12)',
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
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: BorderRadius.xs,
  },
  durationText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#ffffff',
  },
  resultInfo: {
    flex: 1,
    gap: 2,
  },
  resultMain: {
    flex: 1,
    minWidth: 0,
  },
  resultTitle: {
    ...Typography.captionStrong,
    lineHeight: 17,
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
});
