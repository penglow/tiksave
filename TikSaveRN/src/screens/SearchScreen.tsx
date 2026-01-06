import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { Colors, Spacing, BorderRadius } from '../config';
import { SaveItem, SearchMode, getDisplayTitle } from '../types';
import { apiService } from '../services/api';
import { useAppStore } from '../stores/appStore';
import { SearchStackScreenProps } from '../navigation/types';

type Props = SearchStackScreenProps<'SearchMain'>;

const SUGGESTIONS = [
  'ramen tokyo',
  'hotel room tour',
  'temple kyoto',
  'shopping haul',
  'street food',
  'ryokan experience',
];

export default function SearchScreen({ navigation }: Props) {
  const [searchText, setSearchText] = useState('');
  const [searchMode, setSearchMode] = useState<SearchMode>('semantic');
  const [results, setResults] = useState<SaveItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const { recentSearches, addRecentSearch, clearRecentSearches } = useAppStore();

  const handleSearch = async (query?: string) => {
    const searchQuery = query || searchText;
    if (!searchQuery.trim()) return;

    Keyboard.dismiss();
    setIsLoading(true);

    try {
      const data = await apiService.search(searchQuery, searchMode === 'semantic');
      setResults(data);
      addRecentSearch(searchQuery);
    } catch (error) {
      console.error('Search failed:', error);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = () => {
    setSearchText('');
    setResults([]);
  };

  const handleModeChange = (mode: SearchMode) => {
    setSearchMode(mode);
    if (searchText.trim()) {
      handleSearch();
    }
  };

  const showInitialState = !searchText && results.length === 0 && !isLoading;
  const showNoResults = searchText && results.length === 0 && !isLoading;

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchBarContainer}>
        <View style={styles.searchInputContainer}>
          <Ionicons name="search" size={18} color={Colors.textTertiary} />
          <TextInput
            ref={inputRef}
            style={styles.searchInput}
            placeholder="Search by meaning or keywords..."
            placeholderTextColor={Colors.textQuaternary}
            value={searchText}
            onChangeText={setSearchText}
            onSubmitEditing={() => handleSearch()}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setIsSearchFocused(false)}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchText.length > 0 && (
            <TouchableOpacity onPress={handleClear}>
              <Ionicons name="close-circle" size={18} color={Colors.textQuaternary} />
            </TouchableOpacity>
          )}
        </View>

        {isSearchFocused && (
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => {
              Keyboard.dismiss();
              handleClear();
            }}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Search Mode Toggle */}
      {(searchText.length > 0 || results.length > 0) && (
        <View style={styles.modeToggle}>
          {(['semantic', 'keyword'] as SearchMode[]).map((mode) => (
            <TouchableOpacity
              key={mode}
              style={styles.modeButton}
              onPress={() => handleModeChange(mode)}
            >
              <View style={styles.modeButtonContent}>
                <Ionicons
                  name={mode === 'semantic' ? 'bulb' : 'text'}
                  size={14}
                  color={searchMode === mode ? Colors.primary : Colors.textTertiary}
                />
                <Text
                  style={[
                    styles.modeButtonText,
                    searchMode === mode && styles.modeButtonTextActive,
                  ]}
                >
                  {mode === 'semantic' ? 'Semantic' : 'Keyword'}
                </Text>
              </View>
              {searchMode === mode && <View style={styles.modeIndicator} />}
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Content */}
      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : showInitialState ? (
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {/* Recent Searches */}
          {recentSearches.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Recent Searches</Text>
                <TouchableOpacity onPress={clearRecentSearches}>
                  <Text style={styles.clearButton}>Clear</Text>
                </TouchableOpacity>
              </View>
              {recentSearches.map((query) => (
                <TouchableOpacity
                  key={query}
                  style={styles.recentItem}
                  onPress={() => {
                    setSearchText(query);
                    handleSearch(query);
                  }}
                >
                  <Ionicons name="time-outline" size={16} color={Colors.textQuaternary} />
                  <Text style={styles.recentText}>{query}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Suggestions */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Try searching for</Text>
            <View style={styles.suggestionsContainer}>
              {SUGGESTIONS.map((suggestion) => (
                <TouchableOpacity
                  key={suggestion}
                  style={styles.suggestionBadge}
                  onPress={() => {
                    setSearchText(suggestion);
                    handleSearch(suggestion);
                  }}
                >
                  <Text style={styles.suggestionText}>{suggestion}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </ScrollView>
      ) : showNoResults ? (
        <View style={styles.centerContainer}>
          <Ionicons name="search" size={50} color={Colors.textQuaternary} />
          <Text style={styles.noResultsTitle}>No results found</Text>
          <Text style={styles.noResultsSubtitle}>
            Try different keywords or{'\n'}use semantic search
          </Text>
        </View>
      ) : (
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {results.map((item) => (
            <TouchableOpacity
              key={item.id}
              onPress={() => navigation.navigate('VideoDetail', { item })}
              activeOpacity={0.7}
            >
              <SearchResultRow item={item} searchQuery={searchText} />
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function SearchResultRow({ item, searchQuery }: { item: SaveItem; searchQuery: string }) {
  // Find match context in transcript
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

  return (
    <View style={styles.resultRow}>
      {/* Thumbnail */}
      <LinearGradient
        colors={[`${Colors.secondary}4D`, `${Colors.primary}4D`]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.resultThumbnail}
      >
        <Ionicons name="play" size={20} color="rgba(255, 255, 255, 0.6)" />
      </LinearGradient>

      {/* Info */}
      <View style={styles.resultInfo}>
        <Text style={styles.resultTitle} numberOfLines={2}>
          {getDisplayTitle(item)}
        </Text>

        {item.folderName && (
          <View style={styles.folderRow}>
            <Ionicons name="folder" size={12} color={Colors.primary} />
            <Text style={styles.folderText}>{item.folderName}</Text>
          </View>
        )}

        {matchContext && (
          <Text style={styles.matchContext} numberOfLines={2}>
            {matchContext}
          </Text>
        )}

        {item.detectedTopics.length > 0 && (
          <View style={styles.topicsRow}>
            {item.detectedTopics.slice(0, 3).map((topic) => (
              <View key={topic} style={styles.topicBadge}>
                <Text style={styles.topicText}>{topic}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      <Ionicons name="chevron-forward" size={14} color={Colors.textQuaternary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.overlay,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: Colors.text,
  },
  cancelButton: {
    paddingVertical: Spacing.sm,
  },
  cancelButtonText: {
    color: Colors.textSecondary,
    fontSize: 15,
  },
  modeToggle: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  modeButton: {
    flex: 1,
    alignItems: 'center',
  },
  modeButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: Spacing.sm,
  },
  modeButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textTertiary,
  },
  modeButtonTextActive: {
    color: Colors.primary,
  },
  modeIndicator: {
    height: 2,
    width: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xxl,
  },
  noResultsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textTertiary,
    marginTop: Spacing.lg,
  },
  noResultsSubtitle: {
    fontSize: 14,
    color: Colors.textQuaternary,
    textAlign: 'center',
    marginTop: Spacing.sm,
    lineHeight: 20,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    gap: Spacing.xxl,
  },
  section: {
    gap: Spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  clearButton: {
    fontSize: 13,
    color: Colors.textTertiary,
  },
  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  recentText: {
    fontSize: 15,
    color: Colors.textSecondary,
  },
  suggestionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  suggestionBadge: {
    backgroundColor: Colors.overlay,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  suggestionText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    backgroundColor: Colors.overlayLight,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
  },
  resultThumbnail: {
    width: 70,
    height: 90,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resultInfo: {
    flex: 1,
    gap: Spacing.xs,
  },
  resultTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
  },
  folderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  folderText: {
    fontSize: 12,
    color: Colors.primary,
  },
  matchContext: {
    fontSize: 12,
    color: Colors.textTertiary,
  },
  topicsRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  topicBadge: {
    backgroundColor: Colors.overlay,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  topicText: {
    fontSize: 11,
    color: Colors.textTertiary,
  },
});

