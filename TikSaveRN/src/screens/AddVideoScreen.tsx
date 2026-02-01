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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { Spacing, BorderRadius, Typography, Hairline } from '../config';
import { apiService } from '../services/api';
import { useAppStore } from '../stores/appStore';
import { LibraryStackScreenProps, AddStackScreenProps } from '../navigation/types';
import { useTheme } from '../hooks/useTheme';
import { AnimatedPressable, AnimatedListItem, AnimatedText } from '../components';

type Props =
  | LibraryStackScreenProps<'AddVideo'>
  | AddStackScreenProps<'AddMain'>;

export default function AddVideoScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [isImporting, setIsImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [manualUrl, setManualUrl] = useState('');
  const pendingShareUrl = useAppStore((state) => state.pendingShareUrl);
  const clearPendingShare = useAppStore((state) => state.clearPendingShare);

  useFocusEffect(
    useCallback(() => {
      return () => {
        setImportStatus('idle');
        setManualUrl('');
        setIsImporting(false);
      };
    }, [])
  );

  useEffect(() => {
    if (pendingShareUrl) {
      handleImport(pendingShareUrl);
      clearPendingShare();
    }
  }, [pendingShareUrl]);

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
      await apiService.createSaveItem(url);

      setImportStatus('success');
      setManualUrl('');

      setTimeout(() => {
        try {
          (navigation as any).navigate('LibraryMain');
        } catch {
          navigation.goBack();
        }
      }, 1500);
    } catch (error) {
      console.error('Failed to import:', error);
      setImportStatus('error');
    } finally {
      setIsImporting(false);
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

    // Validate all URLs
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

      const message = `${result.queued} queued, ${result.duplicates} duplicates, ${result.errors} errors`;
      
      setImportStatus('success');
      setManualUrl('');

      if (Platform.OS === 'web') {
        window.alert(`Import successful! ${message}`);
      }

      setTimeout(() => {
        try {
          (navigation as any).navigate('LibraryMain');
        } catch {
          navigation.goBack();
        }
      }, 2000);
    } catch (error) {
      console.error('Failed to batch import:', error);
      setImportStatus('error');
    } finally {
      setIsImporting(false);
    }
  };

  const handleManualImport = () => {
    if (manualUrl.trim()) {
      // Check if multiple URLs (contains newlines)
      if (manualUrl.includes('\n')) {
        handleBatchImport();
      } else {
        handleImport(manualUrl.trim());
      }
    }
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + Spacing.md }]}
      keyboardShouldPersistTaps="handled"
    >
      {/* Header */}
      <Animated.View entering={FadeIn.duration(150)} style={styles.header}>
        <AnimatedText style={[styles.title, { color: colors.text }]}>
          Import Video
        </AnimatedText>
      </Animated.View>

      {/* Status Display */}
      {isImporting && (
        <Animated.View
          entering={FadeInDown.duration(150)}
          style={[styles.statusCard, { backgroundColor: colors.accentSubtle }]}
        >
          <ActivityIndicator size="small" color={colors.text} />
          <Text style={[styles.statusText, { color: colors.text }]}>
            Importing...
          </Text>
        </Animated.View>
      )}

      {importStatus === 'success' && !isImporting && (
        <Animated.View
          entering={FadeInDown.duration(150)}
          style={[styles.statusCard, { backgroundColor: colors.successSubtle }]}
        >
          <Ionicons name="checkmark" size={18} color={colors.success} />
          <Text style={[styles.statusText, { color: colors.success }]}>
            Video imported
          </Text>
        </Animated.View>
      )}

      {importStatus === 'error' && !isImporting && (
        <Animated.View
          entering={FadeInDown.duration(150)}
          style={[styles.statusCard, { backgroundColor: colors.errorSubtle }]}
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
                PASTE TIKTOK URLS (ONE PER LINE)
              </Text>
              <View style={[styles.inputWrapper, { borderColor: colors.border, minHeight: 100 }]}>
                <TextInput
                  style={[styles.input, styles.multilineInput, { color: colors.text }]}
                  placeholder="https://tiktok.com/...&#10;https://tiktok.com/...&#10;https://tiktok.com/..."
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
            <View style={[styles.infoCard, { borderColor: colors.border }]}>
              <View style={styles.infoRow}>
                <Ionicons name="sparkles" size={14} color={colors.textSecondary} />
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
      <Text style={[styles.stepNumber, { color: colors.textQuaternary }]}>
        {number}.
      </Text>
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
  },
  title: {
    ...Typography.displayMd,
  },

  // Status cards
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.lg,
  },
  statusText: {
    ...Typography.bodyStrong,
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
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.md,
  },
  input: {
    flex: 1,
    paddingVertical: Spacing.md,
    ...Typography.body,
  },
  clearButton: {
    padding: Spacing.xs,
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
  stepNumber: {
    ...Typography.body,
    width: 20,
  },
  stepText: {
    ...Typography.body,
  },

  // Info card
  infoCard: {
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    padding: Spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  infoText: {
    ...Typography.bodySm,
    flex: 1,
    lineHeight: 20,
  },
});
