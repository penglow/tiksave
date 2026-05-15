import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  Layout,
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';

import {
  Spacing,
  BorderRadius,
  Typography,
  Hairline,
  Shadows,
  TAB_BAR_OVERLAP,
  Animation,
} from '../config';
import { apiService } from '../services/api';
import { useAppStore } from '../stores/appStore';
import { LibraryStackScreenProps, AddStackScreenProps } from '../navigation/types';
import { useTheme } from '../hooks/useTheme';
import { useClipboard } from '../hooks/useClipboard';
import {
  AnimatedPressable,
  LogoMark,
  WordReveal,
  MorphButton,
  type MorphState,
  UrlPreviewChip,
  ProcessingProgress,
} from '../components';
import {
  fetchTikTokOEmbedPreview,
  type TikTokOEmbedPreview,
} from '../utils/tiktokOEmbed';
import { usePaginationCacheStore } from '../stores/paginationCacheStore';

type Props =
  | LibraryStackScreenProps<'AddVideo'>
  | AddStackScreenProps<'AddMain'>;

interface ImportingItem {
  id: string;
  url: string;
  status: 'processing' | 'complete' | 'error';
  generation: number;
}

const URL_SPLIT = /[\s,]+/;
const TIKTOK_HOSTS = ['tiktok.com', 'vm.tiktok'];

function isTikTokUrl(s: string): boolean {
  return TIKTOK_HOSTS.some((h) => s.includes(h));
}

function parseUrls(input: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of input.split(URL_SPLIT)) {
    const u = raw.trim();
    if (!u || seen.has(u)) continue;
    seen.add(u);
    out.push(u);
  }
  return out;
}

export default function AddVideoScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const [manualUrl, setManualUrl] = useState('');
  const [importingItems, setImportingItems] = useState<ImportingItem[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [pendingSubmit, setPendingSubmit] = useState(false);
  const [importStatus, setImportStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [previews, setPreviews] = useState<Record<string, { loading: boolean; data?: TikTokOEmbedPreview }>>({});
  const [howToOpen, setHowToOpen] = useState(false);
  const [cancellingItemIds, setCancellingItemIds] = useState<Set<string>>(new Set());

  const importGenerationRef = useRef(0);
  const finalizedForGenerationRef = useRef<number | null>(null);
  const finalizeInflightRef = useRef(false);
  const errorTimerRef = useRef<NodeJS.Timeout | null>(null);

  const inputShake = useSharedValue(0);

  const pendingShareUrl = useAppStore((state) => state.pendingShareUrl);
  const clearPendingShare = useAppStore((state) => state.clearPendingShare);

  const { urls: clipboardUrls, hasUrls: hasClipboardUrls, dismissUrls, clearUrls } = useClipboard({
    autoCheck: true,
    onlyNew: true,
  });

  const parsedUrls = useMemo(() => parseUrls(manualUrl), [manualUrl]);
  const validUrls = useMemo(() => parsedUrls.filter(isTikTokUrl), [parsedUrls]);

  const showHowTo = manualUrl.length === 0 && !isImporting && importStatus === 'idle';

  // Auto-collapse "how to" when input gets content
  useEffect(() => {
    if (manualUrl.length > 0) setHowToOpen(false);
  }, [manualUrl.length]);

  // Inline-error auto-dismiss
  useEffect(() => {
    if (errorTimerRef.current) {
      clearTimeout(errorTimerRef.current);
      errorTimerRef.current = null;
    }
    if (errorMessage) {
      errorTimerRef.current = setTimeout(() => setErrorMessage(null), 4000);
    }
    return () => {
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    };
  }, [errorMessage]);

  // Clear error when user edits the input
  useEffect(() => {
    if (manualUrl.length > 0) setErrorMessage(null);
  }, [manualUrl]);

  // Debounced oEmbed previews per URL
  useEffect(() => {
    const targets = validUrls.slice(0, 8);
    if (targets.length === 0) {
      setPreviews({});
      return;
    }

    let cancelled = false;
    const handle = setTimeout(() => {
      setPreviews((prev) => {
        const next: typeof prev = {};
        for (const u of targets) {
          next[u] = prev[u] ?? { loading: true };
        }
        return next;
      });

      targets.forEach((url) => {
        // Skip if we already have data
        const existing = previews[url];
        if (existing && existing.data) return;
        void fetchTikTokOEmbedPreview(url).then((data) => {
          if (cancelled) return;
          setPreviews((prev) => ({ ...prev, [url]: { loading: false, data } }));
        });
      });
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
    // intentional: deps tracked via [manualUrl] only
  }, [manualUrl]);

  const nextImportGeneration = () => {
    importGenerationRef.current += 1;
    finalizedForGenerationRef.current = null;
    return importGenerationRef.current;
  };

  const triggerInputShake = () => {
    inputShake.value = withSequence(
      withTiming(-Animation.shake.amplitude, { duration: 60, easing: Easing.out(Easing.quad) }),
      withTiming(Animation.shake.amplitude, { duration: 60, easing: Easing.inOut(Easing.quad) }),
      withTiming(-Animation.shake.amplitude * 0.6, { duration: 60, easing: Easing.inOut(Easing.quad) }),
      withTiming(Animation.shake.amplitude * 0.4, { duration: 60, easing: Easing.inOut(Easing.quad) }),
      withTiming(0, { duration: 80, easing: Easing.in(Easing.quad) }),
    );
  };

  const inputShakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: inputShake.value }],
  }));

  useEffect(() => () => cancelAnimation(inputShake), [inputShake]);

  const finalizeImportSession = useCallback(
    async (items: ImportingItem[], generation: number) => {
      if (finalizeInflightRef.current) return;
      finalizeInflightRef.current = true;
      try {
        if (
          generation !== importGenerationRef.current ||
          finalizedForGenerationRef.current === generation
        ) {
          return;
        }
        finalizedForGenerationRef.current = generation;

        usePaginationCacheStore.getState().clearAll();

        const successes = items.filter((i) => i.status === 'complete');
        const failures = items.filter((i) => i.status === 'error');

        setImportStatus(successes.length === 0 && failures.length > 0 ? 'error' : 'success');

        await new Promise((r) => setTimeout(r, 750));

        if (generation !== importGenerationRef.current) return;

        const nav = navigation as unknown as {
          navigate: (name: string, params?: Record<string, unknown>) => void;
        };

        if (successes.length === 1 && failures.length === 0) {
          try {
            const saved = await apiService.getItem(successes[0].id);
            nav.navigate('Library', { screen: 'VideoDetail', params: { item: saved } });
          } catch {
            nav.navigate('Library', { screen: 'LibraryMain' });
          }
        } else if (successes.length > 0) {
          nav.navigate('Library', { screen: 'LibraryMain' });
        }

        // Reset local UI back to idle
        setIsImporting(false);
        setImportingItems([]);
        setManualUrl('');
        setPreviews({});
        setPendingSubmit(false);
        setImportStatus('idle');
      } finally {
        finalizeInflightRef.current = false;
      }
    },
    [navigation],
  );

  const updateItemStatus = useCallback(
    (itemId: string, status: 'complete' | 'error') => {
      setImportingItems((prev) => {
        const next = prev.map((i) =>
          i.id === itemId ? { ...i, status } : i,
        );
        const stillWorking = next.some((i) => i.status === 'processing');
        if (!stillWorking && next.length > 0) {
          const gen = next[0].generation;
          setTimeout(() => void finalizeImportSession(next, gen), 0);
        }
        return next;
      });
    },
    [finalizeImportSession],
  );

  const handleSingleImport = async (url: string) => {
    if (!isTikTokUrl(url)) {
      setErrorMessage("That doesn't look like a TikTok URL.");
      triggerInputShake();
      return;
    }
    const generation = nextImportGeneration();
    setPendingSubmit(true);
    setIsImporting(true);
    setImportStatus('idle');
    setErrorMessage(null);

    try {
      const item = await apiService.createSaveItem(url);
      const queued: ImportingItem = {
        id: item.id,
        url,
        status: 'processing',
        generation,
      };
      setImportingItems([queued]);
      setPendingSubmit(false);
      if (item.status === 'ready' || item.status === 'needs_review') {
        setTimeout(() => updateItemStatus(item.id, 'complete'), 0);
      }
    } catch (err) {
      setPendingSubmit(false);
      console.error('Failed to import:', err);
      setImportStatus('error');
      setIsImporting(false);
      setErrorMessage('Import failed. Please try again.');
    }
  };

  const handleBatchImport = async (urls: string[]) => {
    const invalid = urls.filter((u) => !isTikTokUrl(u));
    if (invalid.length > 0) {
      setErrorMessage(`${invalid.length} URL(s) are not TikTok links.`);
      triggerInputShake();
      return;
    }

    const generation = nextImportGeneration();
    setPendingSubmit(true);
    setIsImporting(true);
    setImportStatus('idle');
    setErrorMessage(null);

    try {
      const result = await apiService.batchCreateSaveItems(urls, {
        skipDuplicates: true,
        autoOrganize: true,
      });

      const queued: ImportingItem[] = result.items
        .filter((i) => i.status === 'queued')
        .map((i) => ({
          id: i.id,
          url: i.url,
          status: 'processing',
          generation,
        }));

      setImportingItems(queued);
      setPendingSubmit(false);

      const hasFeedback = result.duplicates > 0 || result.errors > 0;
      if (hasFeedback) {
        setErrorMessage(
          `${result.queued} queued · ${result.duplicates} duplicates · ${result.errors} errors`,
        );
      }

      if (queued.length === 0) {
        setIsImporting(false);
        // If there's a duplicate/error message, hold briefly so the user sees it before navigating.
        if (hasFeedback) {
          await new Promise((r) => setTimeout(r, 1800));
        }
        const nav = navigation as unknown as {
          navigate: (name: string, params?: Record<string, unknown>) => void;
        };
        nav.navigate('Library', { screen: 'LibraryMain' });
      }
    } catch (err) {
      setPendingSubmit(false);
      console.error('Failed to batch import:', err);
      setImportStatus('error');
      setIsImporting(false);
      setErrorMessage('Batch import failed. Please try again.');
    }
  };

  const handleCancelImport = async (itemId: string) => {
    setCancellingItemIds((prev) => {
      const next = new Set(prev);
      next.add(itemId);
      return next;
    });
    try {
      await apiService.deleteItem(itemId);
      setImportingItems((prev) => {
        const removed = prev.find((i) => i.id === itemId);
        const gen = removed?.generation ?? importGenerationRef.current;
        const next = prev.filter((i) => i.id !== itemId);
        if (next.length === 0) {
          setIsImporting(false);
          setImportStatus('idle');
        } else {
          const stillWorking = next.some((i) => i.status === 'processing');
          if (!stillWorking) {
            setTimeout(() => void finalizeImportSession(next, gen), 0);
          }
        }
        return next;
      });
    } catch (err) {
      console.error(`Failed to cancel ${itemId}:`, err);
    } finally {
      setCancellingItemIds((prev) => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    }
  };

  const handlePrimaryPress = () => {
    if (validUrls.length === 0) return;
    if (validUrls.length === 1) {
      void handleSingleImport(validUrls[0]);
    } else {
      void handleBatchImport(validUrls);
    }
  };

  const handleEmptyPress = () => {
    triggerInputShake();
  };

  const handleProgressPress = () => {
    const cancelAll = () => {
      importingItems
        .filter((i) => i.status === 'processing' && !cancellingItemIds.has(i.id))
        .forEach((i) => void handleCancelImport(i.id));
    };

    if (Platform.OS === 'web') {
      const ok = window.confirm('Cancel all in-progress imports?');
      if (ok) cancelAll();
      return;
    }

    Alert.alert(
      'Cancel imports?',
      'This will stop all imports currently in progress.',
      [
        { text: 'Keep importing', style: 'cancel' },
        { text: 'Cancel imports', style: 'destructive', onPress: cancelAll },
      ],
    );
  };

  const handleRemoveUrl = (url: string) => {
    const remaining = parsedUrls.filter((u) => u !== url);
    setManualUrl(remaining.join('\n'));
  };

  // Share-extension hand-off
  useEffect(() => {
    if (pendingShareUrl) {
      void handleSingleImport(pendingShareUrl);
      clearPendingShare();
    }
    // intentional: deps tracked via [pendingShareUrl] only
  }, [pendingShareUrl]);

  // Map UI status → MorphState
  const morphState: MorphState = useMemo(() => {
    if (importStatus === 'success') return { kind: 'done' };
    if (importStatus === 'error' && !isImporting) return { kind: 'error' };
    if (pendingSubmit) return { kind: 'submitting' };
    if (isImporting && importingItems.length > 0) {
      const total = importingItems.length;
      const completed = importingItems.filter((i) => i.status !== 'processing').length;
      return { kind: 'progress', completed, total };
    }
    return { kind: 'idle' };
  }, [importStatus, isImporting, importingItems, pendingSubmit]);

  const morphLabel =
    validUrls.length === 0
      ? 'Paste a link to start'
      : `Import ${validUrls.length} →`;

  const morphVariant = validUrls.length === 0 && morphState.kind === 'idle' ? 'ghost' : 'solid';

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + Spacing.md }]}
      keyboardShouldPersistTaps="handled"
    >
      {/* Header */}
      <Animated.View entering={FadeIn.duration(180)} style={styles.header}>
        <View style={styles.brandRow}>
          <LogoMark size={16} color={colors.accent} />
          <Text style={[styles.brandLabel, { color: colors.textTertiary }]}>TIKSAVE · IMPORT</Text>
        </View>
        <WordReveal
          segments={[
            { text: 'Save it for' },
            { text: 'later.', style: { color: colors.accent, fontStyle: 'italic' } },
          ]}
          style={{ ...(styles.title as any), color: colors.text }}
          stagger={45}
        />
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Paste a TikTok link — or eight. We'll transcribe, tag and file each one.
        </Text>
      </Animated.View>

      {/* Clipboard chip */}
      {hasClipboardUrls && manualUrl.length === 0 && !isImporting && importStatus === 'idle' && (
        <Animated.View
          entering={FadeInDown.duration(180)}
          exiting={FadeOut.duration(120)}
          style={[styles.clipboardChip, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <Ionicons name="clipboard-outline" size={16} color={colors.accent} />
          <AnimatedPressable
            onPress={() => {
              setManualUrl(clipboardUrls.join('\n'));
              clearUrls();
            }}
            style={styles.clipboardChipMain}
            accessibilityLabel={`Use ${clipboardUrls.length} clipboard link${clipboardUrls.length > 1 ? 's' : ''}`}
          >
            <Text style={[styles.clipboardChipText, { color: colors.text }]} numberOfLines={1}>
              {clipboardUrls.length === 1
                ? 'Use clipboard link'
                : `Use ${clipboardUrls.length} clipboard links`}
            </Text>
            <Ionicons name="chevron-forward" size={14} color={colors.textTertiary} />
          </AnimatedPressable>
          <AnimatedPressable
            onPress={dismissUrls}
            style={styles.clipboardChipDismiss}
            accessibilityLabel="Dismiss clipboard suggestion"
          >
            <Ionicons name="close" size={14} color={colors.textTertiary} />
          </AnimatedPressable>
        </Animated.View>
      )}

      {/* Input */}
      {!isImporting && (
        <View style={styles.inputBlock}>
          <Text style={[styles.inputLabel, { color: colors.textTertiary }]}>
            PASTE TIKTOK URLS
          </Text>
          <Animated.View
            style={[
              styles.inputWrapper,
              { borderColor: colors.border, backgroundColor: colors.surface },
              inputShakeStyle,
            ]}
          >
            <TextInput
              style={[styles.input, { color: colors.text }]}
              placeholder={'https://tiktok.com/...\nhttps://tiktok.com/...'}
              placeholderTextColor={colors.textQuaternary}
              value={manualUrl}
              onChangeText={setManualUrl}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              accessibilityLabel="TikTok URLs"
            />
            {manualUrl.length > 0 && (
              <AnimatedPressable
                onPress={() => setManualUrl('')}
                style={styles.clearButton}
                accessibilityLabel="Clear input"
              >
                <Ionicons name="close-circle" size={18} color={colors.textQuaternary} />
              </AnimatedPressable>
            )}
          </Animated.View>

          {parsedUrls.length > 0 && (
            <Text style={[styles.urlCount, { color: colors.textTertiary }]}>
              {parsedUrls.length} URL{parsedUrls.length === 1 ? '' : 's'} detected
              {parsedUrls.length !== validUrls.length
                ? ` · ${parsedUrls.length - validUrls.length} not TikTok`
                : ''}
            </Text>
          )}

          {validUrls.slice(0, 8).map((url) => (
            <Animated.View
              key={url}
              entering={FadeInDown.duration(160)}
              exiting={FadeOut.duration(120)}
              layout={Layout.springify().damping(20).stiffness(220)}
              style={styles.previewRow}
            >
              <UrlPreviewChip
                url={url}
                preview={previews[url]?.data}
                loading={previews[url]?.loading ?? true}
                onRemove={() => handleRemoveUrl(url)}
              />
            </Animated.View>
          ))}
        </View>
      )}

      {/* In-progress list (replaces input area while importing) */}
      {isImporting && importingItems.length > 0 && (
        <View style={styles.inputBlock}>
          <Text style={[styles.inputLabel, { color: colors.textTertiary }]}>
            IMPORTING {importingItems.length} VIDEO{importingItems.length === 1 ? '' : 'S'}
          </Text>
          {importingItems.map((item) => (
            <Animated.View
              key={item.id}
              entering={FadeIn.duration(180)}
              style={styles.importingRow}
            >
              <ImportingItemRow
                item={item}
                isCancelling={cancellingItemIds.has(item.id)}
                onComplete={() => updateItemStatus(item.id, 'complete')}
                onError={(msg) => {
                  console.error(`Import ${item.id}:`, msg);
                  updateItemStatus(item.id, 'error');
                }}
                onCancel={() => handleCancelImport(item.id)}
              />
            </Animated.View>
          ))}
        </View>
      )}

      {/* Inline error chip */}
      {errorMessage && (
        <Animated.View
          entering={FadeInDown.duration(160)}
          exiting={FadeOut.duration(120)}
          style={[styles.errorChip, { backgroundColor: colors.errorSubtle, borderColor: colors.error }]}
        >
          <Ionicons name="alert-circle-outline" size={16} color={colors.error} />
          <Text style={[styles.errorText, { color: colors.error }]} numberOfLines={2}>
            {errorMessage}
          </Text>
        </Animated.View>
      )}

      {/* Primary CTA */}
      <View style={styles.ctaRow}>
        <MorphButton
          label={morphLabel}
          state={morphState}
          variant={morphVariant}
          onPress={handlePrimaryPress}
          onPressGhost={handleEmptyPress}
          onPressProgress={handleProgressPress}
          onPressRetry={handlePrimaryPress}
          haptic
        />
      </View>

      {/* Collapsed "How to share" accordion */}
      {showHowTo && (
        <Animated.View entering={FadeIn.duration(160)} style={styles.howTo}>
          <AnimatedPressable
            onPress={() => setHowToOpen((v) => !v)}
            style={[styles.howToHeader, { borderColor: colors.border }]}
            accessibilityRole="button"
            accessibilityLabel={howToOpen ? 'Hide how-to' : 'Show how to share from TikTok'}
          >
            <Ionicons
              name={howToOpen ? 'chevron-down' : 'chevron-forward'}
              size={14}
              color={colors.textTertiary}
            />
            <Text style={[styles.howToHeaderText, { color: colors.textSecondary }]}>
              How to share from TikTok
            </Text>
          </AnimatedPressable>
          {howToOpen && (
            <Animated.View entering={FadeInDown.duration(160)} style={styles.howToBody}>
              <StepItem number={1} text="Open TikTok app" />
              <StepItem number={2} text="Tap share on a video" />
              <StepItem number={3} text="Select TikSave" />
              <StepItem number={4} text="Automatically organized" />
            </Animated.View>
          )}
        </Animated.View>
      )}
    </ScrollView>
  );
}

function StepItem({ number, text }: { number: number; text: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.stepItem}>
      <View style={[styles.stepNumberWrapper, { backgroundColor: colors.surfaceHover }]}>
        <Text style={[styles.stepNumber, { color: colors.textSecondary }]}>{number}</Text>
      </View>
      <Text style={[styles.stepText, { color: colors.text }]}>{text}</Text>
    </View>
  );
}

function ImportingItemRow({
  item,
  isCancelling,
  onComplete,
  onError,
  onCancel,
}: {
  item: ImportingItem;
  isCancelling: boolean;
  onComplete: () => void;
  onError: (msg: string) => void;
  onCancel: () => void;
}) {
  const { colors } = useTheme();
  if (item.status === 'processing') {
    return (
      <ProcessingProgress
        itemId={item.id}
        onComplete={onComplete}
        onError={onError}
        onCancel={onCancel}
        isCancelling={isCancelling}
        pollInterval={500}
      />
    );
  }
  if (item.status === 'complete') {
    return (
      <View style={[styles.statusCard, { backgroundColor: colors.successSubtle, borderColor: colors.successSubtle }]}>
        <Ionicons name="checkmark-circle" size={18} color={colors.success} />
        <Text style={[styles.statusText, { color: colors.success }]} numberOfLines={1}>
          Complete
        </Text>
      </View>
    );
  }
  return (
    <View style={[styles.statusCard, { backgroundColor: colors.errorSubtle, borderColor: colors.errorSubtle }]}>
      <Ionicons name="close-circle" size={18} color={colors.error} />
      <Text style={[styles.statusText, { color: colors.error }]} numberOfLines={1}>
        Failed
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 0,
  },
  content: {
    padding: Spacing.md,
    paddingBottom: Spacing.xxl + TAB_BAR_OVERLAP,
    gap: Spacing.md,
  },

  // Header
  header: {
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
  title: {
    ...Typography.displayMd,
    fontSize: 32,
    lineHeight: 36,
  },
  subtitle: {
    ...Typography.body,
    marginTop: Spacing.xs,
    maxWidth: 360,
  },

  // Clipboard chip
  clipboardChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: Spacing.md,
    paddingRight: Spacing.xs,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    gap: Spacing.sm,
    ...Shadows.xs,
  },
  clipboardChipMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.xs,
  },
  clipboardChipText: {
    ...Typography.bodySm,
    fontWeight: '600',
    flex: 1,
  },
  clipboardChipDismiss: {
    padding: Spacing.xs,
  },

  // Input block
  inputBlock: {
    gap: Spacing.sm,
  },
  inputLabel: {
    ...Typography.label,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
    minHeight: 100,
    ...Shadows.xs,
  },
  input: {
    flex: 1,
    ...Typography.body,
    paddingVertical: 0,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  clearButton: {
    padding: Spacing.xs,
  },
  urlCount: {
    ...Typography.caption,
  },
  previewRow: {
    // wrapper for layout animation
  },

  importingRow: {
    // wrapper for layout animation
  },

  // Status sub-cards
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  statusText: {
    ...Typography.bodyStrong,
    flex: 1,
  },

  // Inline error
  errorChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  errorText: {
    ...Typography.bodySm,
    flex: 1,
  },

  // CTA
  ctaRow: {
    marginTop: Spacing.xs,
  },

  // How-to accordion
  howTo: {
    marginTop: Spacing.lg,
    gap: Spacing.sm,
  },
  howToHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingTop: Spacing.md,
    borderTopWidth: Hairline,
  },
  howToHeaderText: {
    ...Typography.bodySm,
    fontWeight: '600',
  },
  howToBody: {
    gap: Spacing.sm,
    paddingLeft: Spacing.md,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  stepNumberWrapper: {
    width: 24,
    height: 24,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumber: {
    ...Typography.captionStrong,
    fontSize: 12,
  },
  stepText: {
    ...Typography.bodySm,
  },
});
