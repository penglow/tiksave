import React, { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Alert,
  Platform,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

import { Spacing, BorderRadius, Typography, Hairline, Gradients } from '../config';
import { apiService } from '../services/api';
import { useAppStore } from '../stores/appStore';
import { LibraryStackScreenProps, AddStackScreenProps } from '../navigation/types';
import { useTheme } from '../hooks/useTheme';
import { useClipboard } from '../hooks/useClipboard';
import { AnimatedPressable, AnimatedListItem, AnimatedText, ProcessingProgress, Card, Badge } from '../components';

type Props =
  | LibraryStackScreenProps<'AddVideo'>
  | AddStackScreenProps<'AddMain'>;

interface ImportingItem {
  id: string;
  url: string;
  status: 'processing' | 'complete' | 'error';
}

interface URLPreview {
  url: string;
  title?: string;
  thumbnailUrl?: string;
}

async function fetchTikTokPreview(url: string): Promise<URLPreview> {
  const fallback: URLPreview = { url };
  try {
    const endpoint = `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`;
    const response = await fetch(endpoint);
    if (!response.ok) return fallback;

    const data = await response.json();
    return {
      url,
      title: typeof data?.title === 'string' ? data.title : undefined,
      thumbnailUrl: typeof data?.thumbnail_url === 'string' ? data.thumbnail_url : undefined,
    };
  } catch {
    return fallback;
  }
}

export default function AddVideoScreen({ navigation }: Props) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [isImporting, setIsImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [manualUrl, setManualUrl] = useState('');
  const [importingItems, setImportingItems] = useState<ImportingItem[]>([]);
  const [cancellingItemIds, setCancellingItemIds] = useState<Set<string>>(new Set());
  const [urlPreviews, setUrlPreviews] = useState<URLPreview[]>([]);
  const [isLoadingPreviews, setIsLoadingPreviews] = useState(false);
  const pendingShareUrl = useAppStore((state) => state.pendingShareUrl);
  const clearPendingShare = useAppStore((state) => state.clearPendingShare);

  const { urls: clipboardUrls, hasUrls: hasClipboardUrls, dismissUrls, clearUrls } = useClipboard({
    autoCheck: true,
    onlyNew: true,
  });

  useFocusEffect(
    useCallback(() => {
      return () => {
        setImportStatus('idle');
        setManualUrl('');
        setIsImporting(false);
        setImportingItems([]);
      };
    }, [])
  );

  useEffect(() => {
    if (pendingShareUrl) {
      handleImport(pendingShareUrl);
      clearPendingShare();
    }
  }, [pendingShareUrl]);

  useEffect(() => {
    if (!isImporting) return;
    if (importingItems.length === 0) {
      setIsImporting(false);
      setImportStatus('idle');
    }
  }, [isImporting, importingItems.length]);

  useEffect(() => {
    const urls = manualUrl
      .split(/\n/)
      .map((u) => u.trim())
      .filter(Boolean);

    const uniqueUrls = [...new Set(urls)]
      .filter((u) => u.includes('tiktok.com') || u.includes('vm.tiktok'))
      .slice(0, 8);

    if (uniqueUrls.length === 0) {
      setUrlPreviews([]);
      setIsLoadingPreviews(false);
      return;
    }

    let cancelled = false;
    setIsLoadingPreviews(true);

    Promise.all(uniqueUrls.map((url) => fetchTikTokPreview(url)))
      .then((previews) => {
        if (!cancelled) {
          setUrlPreviews(previews);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingPreviews(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [manualUrl]);

  const handleImport = async (url: string) => {
    if (!url.includes('tiktok.com') && !url.includes('vm.tiktok')) {
      if (Platform.OS === 'web') {
        window.alert('Please enter a valid TikTok URL');
      } else {
        Alert.alert('Invalid URL', 'Please enter a valid TikTok URL');
      }
      return;
    }

    setIsImporting(true);
    setImportStatus('idle');

    try {
      const item = await apiService.createSaveItem(url);

      setImportingItems([{ id: item.id, url, status: 'processing' }]);
      setManualUrl('');
    } catch (error) {
      console.error('Failed to import:', error);
      setImportStatus('error');
      setIsImporting(false);
    }
  };

  const handleItemComplete = (itemId: string) => {
    setImportingItems(prev =>
      prev.map(item =>
        item.id === itemId ? { ...item, status: 'complete' as const } : item
      )
    );

    setTimeout(() => {
      setImportStatus('success');
      setIsImporting(false);

      setTimeout(() => {
        try {
          (navigation as any).navigate('LibraryMain');
        } catch {
          navigation.goBack();
        }
      }, 1000);
    }, 500);
  };

  const handleItemError = (itemId: string, error: string) => {
    setImportingItems(prev =>
      prev.map(item =>
        item.id === itemId ? { ...item, status: 'error' as const } : item
      )
    );
    console.error(`Item ${itemId} failed:`, error);
  };

  const handleCancelImport = async (itemId: string) => {
    setCancellingItemIds((prev) => {
      const next = new Set(prev);
      next.add(itemId);
      return next;
    });

    try {
      await apiService.deleteItem(itemId);
      setImportingItems(prev =>
        prev.map(item =>
          item.id === itemId ? { ...item, status: 'error' as const } : item
        )
      );

      setTimeout(() => {
        setImportingItems(prev => prev.filter(item => item.id !== itemId));
      }, 300);
    } catch (error) {
      console.error(`Failed to cancel import for item ${itemId}:`, error);
    } finally {
      setCancellingItemIds((prev) => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    }
  };

  const handleBatchImport = async () => {
    const urls = manualUrl
      .split(/\n/)
      .map(url => url.trim())
      .filter(url => url.length > 0);

    if (urls.length === 0) {
      if (Platform.OS === 'web') {
        window.alert('Please enter at least one URL');
      } else {
        Alert.alert('No URLs', 'Please enter at least one URL');
      }
      return;
    }

    const invalidUrls = urls.filter(
      url => !url.includes('tiktok.com') && !url.includes('vm.tiktok')
    );

    if (invalidUrls.length > 0) {
      if (Platform.OS === 'web') {
        window.alert(`Invalid URLs found: ${invalidUrls.join(', ')}`);
      } else {
        Alert.alert('Invalid URLs', `Found ${invalidUrls.length} invalid URL(s)`);
      }
      return;
    }

    setIsImporting(true);
    setImportStatus('idle');

    try {
      const result = await apiService.batchCreateSaveItems(urls, {
        skipDuplicates: true,
        autoOrganize: true,
      });

      const queuedItems: ImportingItem[] = result.items
        .filter(item => item.status === 'queued')
        .map(item => ({ id: item.id, url: item.url, status: 'processing' as const }));

      setImportingItems(queuedItems);
      setManualUrl('');

      if (result.duplicates > 0 || result.errors > 0) {
        const message = `${result.queued} queued, ${result.duplicates} duplicates, ${result.errors} errors`;
        if (Platform.OS === 'web') {
          window.alert(message);
        } else {
          Alert.alert('Import Status', message);
        }
      }

      if (queuedItems.length === 0) {
        setIsImporting(false);
        setTimeout(() => {
          try {
            (navigation as any).navigate('LibraryMain');
          } catch {
            navigation.goBack();
          }
        }, 1500);
      }
    } catch (error) {
      console.error('Failed to batch import:', error);
      setImportStatus('error');
      setIsImporting(false);
    }
  };

  const handleManualImport = () => {
    if (manualUrl.trim()) {
      if (manualUrl.includes('\n')) {
        handleBatchImport();
      } else {
        handleImport(manualUrl.trim());
      }
    }
  };

  const heroGradient = isDark ? Gradients.heroDark : Gradients.heroLight;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + Spacing.md }]}
      keyboardShouldPersistTaps="handled"
    >
      {/* Header */}
      <Animated.View entering={FadeIn.duration(200)} style={styles.header}>
        <AnimatedText style={[styles.title, { color: colors.text }]}>
          Import Video
        </AnimatedText>
        <Text style={[styles.subtitle, { color: colors.textTertiary }]}>
          Paste TikTok URLs to save and organize
        </Text>
      </Animated.View>

      {/* Clipboard Detection Banner */}
      {hasClipboardUrls && !isImporting && importStatus === 'idle' && (
        <Animated.View
          entering={FadeInDown.duration(200)}
          style={[styles.clipboardBanner, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <View style={styles.clipboardHeader}>
            <View style={styles.clipboardTitleRow}>
              <Ionicons name="clipboard-outline" size={18} color={colors.accent} />
              <Text style={[styles.clipboardTitle, { color: colors.text }]}>
                {clipboardUrls.length === 1 ? 'TikTok URL detected' : `${clipboardUrls.length} TikTok URLs detected`}
              </Text>
            </View>
            <AnimatedPressable onPress={dismissUrls} style={styles.clipboardDismiss}>
              <Ionicons name="close" size={18} color={colors.textTertiary} />
            </AnimatedPressable>
          </View>

          <Text style={[styles.clipboardPreview, { color: colors.textSecondary }]} numberOfLines={2}>
            {clipboardUrls.slice(0, 2).join('\n')}
            {clipboardUrls.length > 2 && `\n...and ${clipboardUrls.length - 2} more`}
          </Text>

          <AnimatedPressable
            style={[styles.clipboardImportButton, { backgroundColor: colors.text }]}
            onPress={() => {
              setManualUrl(clipboardUrls.join('\n'));
              clearUrls();
            }}
            haptic
          >
            <Ionicons name="download-outline" size={16} color={colors.background} />
            <Text style={[styles.clipboardImportText, { color: colors.background }]}>
              Import from clipboard
            </Text>
          </AnimatedPressable>
        </Animated.View>
      )}

      {/* Processing Progress Display */}
      {isImporting && importingItems.length > 0 && (
        <Animated.View entering={FadeInDown.duration(200)} style={styles.progressSection}>
          <View style={styles.progressHeaderRow}>
            <Text style={[styles.progressHeader, { color: colors.text }]}>
              Processing
            </Text>
            <Badge
              label={`${importingItems.filter(i => i.status === 'processing').length} of ${importingItems.length}`}
              variant="accent"
              size="sm"
            />
          </View>
          <ScrollView style={styles.progressList} nestedScrollEnabled>
            {importingItems.map((item) => (
              <View key={item.id} style={styles.progressItem}>
                {item.status === 'processing' ? (
                  <ProcessingProgress
                    itemId={item.id}
                    onComplete={() => handleItemComplete(item.id)}
                    onError={(error) => handleItemError(item.id, error)}
                    onCancel={() => handleCancelImport(item.id)}
                    isCancelling={cancellingItemIds.has(item.id)}
                    pollInterval={500}
                  />
                ) : item.status === 'complete' ? (
                  <View style={[styles.statusCard, { backgroundColor: colors.successSubtle, borderColor: colors.successSubtle }]}>
                    <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                    <Text style={[styles.statusText, { color: colors.success }]} numberOfLines={1}>
                      Complete
                    </Text>
                  </View>
                ) : (
                  <View style={[styles.statusCard, { backgroundColor: colors.errorSubtle, borderColor: colors.errorSubtle }]}>
                    <Ionicons name="close-circle" size={18} color={colors.error} />
                    <Text style={[styles.statusText, { color: colors.error }]} numberOfLines={1}>
                      Failed
                    </Text>
                  </View>
                )}
              </View>
            ))}
          </ScrollView>
        </Animated.View>
      )}

      {/* Fallback loading state */}
      {isImporting && importingItems.length === 0 && (
        <Animated.View
          entering={FadeInDown.duration(200)}
          style={[styles.statusCard, { backgroundColor: colors.accentSubtle, borderColor: colors.accentSubtle }]}
        >
          <ActivityIndicator size="small" color={colors.text} />
          <Text style={[styles.statusText, { color: colors.text }]}>
            Starting import...
          </Text>
        </Animated.View>
      )}

      {importStatus === 'success' && !isImporting && (
        <Animated.View
          entering={FadeInDown.duration(200)}
          style={[styles.statusCard, { backgroundColor: colors.successSubtle, borderColor: colors.successSubtle }]}
        >
          <Ionicons name="checkmark" size={18} color={colors.success} />
          <Text style={[styles.statusText, { color: colors.success }]}>
            Video{importingItems.length > 1 ? 's' : ''} imported successfully
          </Text>
        </Animated.View>
      )}

      {importStatus === 'error' && !isImporting && (
        <Animated.View
          entering={FadeInDown.duration(200)}
          style={[styles.statusCard, { backgroundColor: colors.errorSubtle, borderColor: colors.errorSubtle }]}
        >
          <Ionicons name="close" size={18} color={colors.error} />
          <Text style={[styles.statusText, { color: colors.error }]}>
            Import failed
          </Text>
        </Animated.View>
      )}

      {/* Main Content */}
      {!isImporting && importStatus === 'idle' && (
        <>
          {/* URL Input */}
          <AnimatedListItem index={0} direction="fade">
            <View style={styles.inputSection}>
              <Text style={[styles.inputLabel, { color: colors.textTertiary }]}>
                PASTE TIKTOK URLS
              </Text>
              <View style={[styles.inputWrapper, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                <TextInput
                  style={[styles.input, styles.multilineInput, { color: colors.text }]}
                  placeholder="https://tiktok.com/...&#10;https://tiktok.com/..."
                  placeholderTextColor={colors.textQuaternary}
                  value={manualUrl}
                  onChangeText={setManualUrl}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
                {manualUrl.length > 0 && (
                  <AnimatedPressable
                    onPress={() => setManualUrl('')}
                    style={styles.clearButton}
                  >
                    <Ionicons name="close-circle" size={18} color={colors.textQuaternary} />
                  </AnimatedPressable>
                )}
              </View>

              {/* URL Count Indicator */}
              {manualUrl.length > 0 && (
                <Text style={[styles.urlCount, { color: colors.textTertiary }]}>
                  {manualUrl.split(/\n/).filter(url => url.trim().length > 0).length} URL(s)
                </Text>
              )}

              {manualUrl.length > 0 && (
                <View style={styles.previewSection}>
                  <Text style={[styles.previewLabel, { color: colors.textTertiary }]}>
                    PREVIEW
                  </Text>
                  {isLoadingPreviews ? (
                    <Text style={[styles.previewLoadingText, { color: colors.textTertiary }]}>
                      Fetching previews...
                    </Text>
                  ) : (
                    urlPreviews.map((preview) => (
                      <View key={preview.url} style={[styles.previewCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <View style={[styles.previewThumb, { backgroundColor: colors.surfaceHover }]}>
                          {preview.thumbnailUrl ? (
                            <Image source={{ uri: preview.thumbnailUrl }} style={styles.previewThumbImage} />
                          ) : (
                            <Ionicons name="play-circle-outline" size={22} color={colors.textTertiary} />
                          )}
                        </View>
                        <View style={styles.previewTextWrap}>
                          <Text style={[styles.previewTitle, { color: colors.text }]} numberOfLines={2}>
                            {preview.title || 'TikTok Video'}
                          </Text>
                          <Text style={[styles.previewUrl, { color: colors.textTertiary }]} numberOfLines={1}>
                            {preview.url}
                          </Text>
                        </View>
                      </View>
                    ))
                  )}
                </View>
              )}

              <AnimatedPressable
                style={[
                  styles.importButton,
                  { backgroundColor: colors.text },
                  !manualUrl.trim() && styles.importButtonDisabled,
                ]}
                onPress={handleManualImport}
                disabled={!manualUrl.trim()}
                haptic
              >
                <Text style={[
                  styles.importButtonText,
                  { color: colors.background }
                ]}>
                  Import
                </Text>
                <Ionicons
                  name="arrow-forward"
                  size={16}
                  color={colors.background}
                />
              </AnimatedPressable>
            </View>
          </AnimatedListItem>

          {/* Divider */}
          <AnimatedListItem index={1} direction="fade">
            <View style={styles.divider}>
              <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
              <Text style={[styles.dividerText, { color: colors.textQuaternary }]}>
                or on mobile
              </Text>
              <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            </View>
          </AnimatedListItem>

          {/* Instructions */}
          <AnimatedListItem index={2} direction="fade">
            <View style={styles.instructionsSection}>
              <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>
                HOW TO IMPORT
              </Text>

              <View style={styles.stepsList}>
                <StepItem number={1} text="Open TikTok app" />
                <StepItem number={2} text="Tap share on a video" />
                <StepItem number={3} text="Select TikSave" />
                <StepItem number={4} text="Automatically organized" />
              </View>
            </View>
          </AnimatedListItem>

          {/* Info */}
          <AnimatedListItem index={3} direction="fade">
            <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.infoRow}>
                <Ionicons name="sparkles" size={16} color={colors.accent} />
                <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                  Videos are analyzed and sorted into categories automatically
                </Text>
              </View>
            </View>
          </AnimatedListItem>
        </>
      )}
    </ScrollView>
  );
}

function StepItem({ number, text }: { number: number; text: string }) {
  const { colors } = useTheme();

  return (
    <View style={styles.stepItem}>
      <View style={[styles.stepNumberWrapper, { backgroundColor: colors.surfaceHover }]}>
        <Text style={[styles.stepNumber, { color: colors.textSecondary }]}>
          {number}
        </Text>
      </View>
      <Text style={[styles.stepText, { color: colors.text }]}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: Spacing.md,
    paddingBottom: Spacing.xxl,
  },
  header: {
    marginBottom: Spacing.xl,
    gap: Spacing.xs,
  },
  title: {
    ...Typography.displayMd,
  },
  subtitle: {
    ...Typography.body,
  },

  // Clipboard banner
  clipboardBanner: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  clipboardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  clipboardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  clipboardTitle: {
    ...Typography.bodyStrong,
  },
  clipboardDismiss: {
    padding: Spacing.xs,
  },
  clipboardPreview: {
    ...Typography.bodySm,
  },
  clipboardImportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.xs,
  },
  clipboardImportText: {
    ...Typography.bodyStrong,
  },

  // Progress section
  progressSection: {
    marginBottom: Spacing.lg,
  },
  progressHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  progressHeader: {
    ...Typography.bodyStrong,
  },
  progressList: {
    maxHeight: 300,
  },
  progressItem: {
    marginBottom: Spacing.sm,
  },

  // Status cards
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.lg,
    borderWidth: 1,
  },
  statusText: {
    ...Typography.bodyStrong,
    flex: 1,
  },

  // Input section
  inputSection: {
    marginBottom: Spacing.lg,
  },
  inputLabel: {
    ...Typography.label,
    marginBottom: Spacing.sm,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    marginBottom: Spacing.md,
    minHeight: 100,
  },
  input: {
    flex: 1,
    ...Typography.body,
    paddingVertical: 0,
  },
  multilineInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  clearButton: {
    padding: Spacing.xs,
  },
  urlCount: {
    ...Typography.caption,
    marginBottom: Spacing.sm,
  },
  previewSection: {
    marginBottom: Spacing.md,
    gap: Spacing.xs,
  },
  previewLabel: {
    ...Typography.label,
  },
  previewLoadingText: {
    ...Typography.caption,
    marginTop: Spacing.xs,
  },
  previewCard: {
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    padding: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  previewThumb: {
    width: 46,
    height: 62,
    borderRadius: BorderRadius.xs,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewThumbImage: {
    width: '100%',
    height: '100%',
  },
  previewTextWrap: {
    flex: 1,
  },
  previewTitle: {
    ...Typography.captionStrong,
    lineHeight: 16,
  },
  previewUrl: {
    ...Typography.caption,
    marginTop: 2,
  },
  importButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.sm,
  },
  importButtonDisabled: {
    opacity: 0.3,
  },
  importButtonText: {
    ...Typography.bodyStrong,
  },

  // Divider
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: Spacing.lg,
  },
  dividerLine: {
    flex: 1,
    height: Hairline,
  },
  dividerText: {
    ...Typography.caption,
    paddingHorizontal: Spacing.md,
  },

  // Instructions
  instructionsSection: {
    marginBottom: Spacing.lg,
  },
  sectionLabel: {
    ...Typography.label,
    marginBottom: Spacing.md,
  },
  stepsList: {
    gap: Spacing.sm,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  stepNumberWrapper: {
    width: 28,
    height: 28,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumber: {
    ...Typography.captionStrong,
    fontSize: 13,
  },
  stepText: {
    ...Typography.body,
  },

  // Info card
  infoCard: {
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    alignItems: 'center',
  },
  infoText: {
    ...Typography.bodySm,
    flex: 1,
    lineHeight: 20,
  },
});
