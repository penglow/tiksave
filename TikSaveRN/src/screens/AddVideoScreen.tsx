import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Alert,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { Colors, Spacing, BorderRadius } from '../config';
import { apiService } from '../services/api';
import { useAppStore } from '../stores/appStore';
import { LibraryStackScreenProps, AddStackScreenProps } from '../navigation/types';
import type { NavigationProp } from '@react-navigation/native';
import { useTheme } from '../hooks/useTheme';

type Props = 
  | LibraryStackScreenProps<'AddVideo'>
  | AddStackScreenProps<'AddMain'>;

export default function AddVideoScreen({ navigation }: Props) {
  const { colors: themeColors } = useTheme();
  const [isImporting, setIsImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [manualUrl, setManualUrl] = useState('');
  const pendingShareUrl = useAppStore((state) => state.pendingShareUrl);
  const clearPendingShare = useAppStore((state) => state.clearPendingShare);

  // Handle incoming share
  useEffect(() => {
    if (pendingShareUrl) {
      handleImport(pendingShareUrl);
      clearPendingShare();
    }
  }, [pendingShareUrl]);

  const handleImport = async (url: string) => {
    // Validate TikTok URL
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
      
      // Navigate to library after short delay
      setTimeout(() => {
        // Try to navigate to LibraryMain, fallback to going back
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

  const handleManualImport = () => {
    if (manualUrl.trim()) {
      handleImport(manualUrl.trim());
    }
  };

  // Create theme-aware styles
  const themeStyles = React.useMemo(() => ({
    statusText: { ...styles.statusText, color: themeColors.text },
    statusSubtext: { ...styles.statusSubtext, color: themeColors.textTertiary },
    devLabel: { ...styles.devLabel, color: themeColors.warning },
    urlInput: { ...styles.urlInput, backgroundColor: themeColors.background, color: themeColors.text },
    importBtnText: { ...styles.importBtnText, color: themeColors.text },
    dividerText: { ...styles.dividerText, color: themeColors.textQuaternary },
    heroTitle: { ...styles.heroTitle, color: themeColors.text },
    heroSubtitle: { ...styles.heroSubtitle, color: themeColors.textTertiary },
    stepsTitle: { ...styles.stepsTitle, color: themeColors.text },
    stepTitle: { ...styles.stepTitle, color: themeColors.text },
    stepDesc: { ...styles.stepDesc, color: themeColors.textTertiary },
    stepNumberText: { ...styles.stepNumberText, color: themeColors.text },
  }), [themeColors]);

  return (
    <ScrollView 
      style={[styles.container, { backgroundColor: themeColors.background }]}
      contentContainerStyle={styles.scrollContent}
    >
      {/* Status Display */}
      {isImporting && (
        <View style={[styles.statusCard, { backgroundColor: themeColors.backgroundSecondary }]}>
          <ActivityIndicator size="large" color={themeColors.primary} />
          <Text style={themeStyles.statusText}>Importing & analyzing with AI...</Text>
        </View>
      )}

      {importStatus === 'success' && !isImporting && (
        <View style={[styles.statusCard, styles.successCard, { backgroundColor: `${themeColors.success}15` }]}>
          <Ionicons name="checkmark-circle" size={48} color={themeColors.success} />
          <Text style={themeStyles.statusText}>Video imported!</Text>
          <Text style={themeStyles.statusSubtext}>AI is categorizing it now...</Text>
        </View>
      )}

      {importStatus === 'error' && !isImporting && (
        <View style={[styles.statusCard, styles.errorCard, { backgroundColor: `${themeColors.error}15` }]}>
          <Ionicons name="close-circle" size={48} color={themeColors.error} />
          <Text style={themeStyles.statusText}>Import failed</Text>
          <Text style={themeStyles.statusSubtext}>Please try again</Text>
        </View>
      )}

      {/* Main Content - How to Import */}
      {!isImporting && importStatus === 'idle' && (
        <>
          {/* Manual URL Input - Dev Mode */}
          <View style={[styles.devSection, { backgroundColor: `${themeColors.warning}15`, borderColor: `${themeColors.warning}30` }]}>
            <View style={styles.devHeader}>
              <Ionicons name="code-slash" size={16} color={themeColors.warning} />
              <Text style={themeStyles.devLabel}>Dev Mode: Paste URL</Text>
            </View>
            <View style={[styles.urlInputContainer, { backgroundColor: themeColors.background }]}>
              <TextInput
                style={themeStyles.urlInput}
                placeholder="Paste TikTok URL here..."
                placeholderTextColor={themeColors.textQuaternary}
                value={manualUrl}
                onChangeText={setManualUrl}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                returnKeyType="go"
                onSubmitEditing={handleManualImport}
              />
              {manualUrl.length > 0 && (
                <TouchableOpacity onPress={() => setManualUrl('')} style={styles.clearBtn}>
                  <Ionicons name="close-circle" size={18} color={themeColors.textTertiary} />
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity
              style={[styles.importBtn, { backgroundColor: themeColors.primary }, !manualUrl.trim() && styles.importBtnDisabled]}
              onPress={handleManualImport}
              disabled={!manualUrl.trim()}
              activeOpacity={0.8}
            >
              <Ionicons name="arrow-forward" size={18} color={themeColors.text} />
              <Text style={themeStyles.importBtnText}>Import</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or on mobile</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Hero */}
          <View style={styles.heroSection}>
            <LinearGradient
              colors={[`${themeColors.primary}30`, `${themeColors.secondary}30`]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroIcon}
            >
              <Text style={styles.heroEmoji}>📲</Text>
            </LinearGradient>
            <Text style={themeStyles.heroTitle}>Share from TikTok</Text>
            <Text style={themeStyles.heroSubtitle}>
              Import videos directly from the TikTok app
            </Text>
          </View>

          {/* Steps */}
          <View style={[styles.stepsContainer, { backgroundColor: themeColors.backgroundSecondary }]}>
            <Text style={themeStyles.stepsTitle}>How to Import</Text>
            
            <View style={styles.step}>
              <View style={styles.stepNumberContainer}>
                <LinearGradient
                  colors={[themeColors.primary, themeColors.secondary]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.stepNumber}
                >
                  <Text style={themeStyles.stepNumberText}>1</Text>
                </LinearGradient>
              </View>
              <View style={styles.stepContent}>
                <Text style={themeStyles.stepTitle}>Open TikTok</Text>
                <Text style={themeStyles.stepDesc}>Find a video you want to save</Text>
              </View>
              <View style={styles.stepIcon}>
                <Text style={styles.stepEmoji}>📱</Text>
              </View>
            </View>

            <View style={[styles.stepConnector, { backgroundColor: themeColors.border }]} />
            
            <View style={styles.step}>
              <View style={styles.stepNumberContainer}>
                <LinearGradient
                  colors={[themeColors.primary, themeColors.secondary]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.stepNumber}
                >
                  <Text style={themeStyles.stepNumberText}>2</Text>
                </LinearGradient>
              </View>
              <View style={styles.stepContent}>
                <Text style={themeStyles.stepTitle}>Tap Share</Text>
                <Text style={themeStyles.stepDesc}>Press the arrow icon on the video</Text>
              </View>
              <View style={styles.stepIcon}>
                <Ionicons name="arrow-redo" size={24} color={themeColors.textSecondary} />
              </View>
            </View>

            <View style={[styles.stepConnector, { backgroundColor: themeColors.border }]} />
            
            <View style={styles.step}>
              <View style={styles.stepNumberContainer}>
                <LinearGradient
                  colors={[themeColors.primary, themeColors.secondary]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.stepNumber}
                >
                  <Text style={themeStyles.stepNumberText}>3</Text>
                </LinearGradient>
              </View>
              <View style={styles.stepContent}>
                <Text style={themeStyles.stepTitle}>Choose TikSave</Text>
                <Text style={themeStyles.stepDesc}>Select this app from the share sheet</Text>
              </View>
              <View style={styles.stepIcon}>
                <View style={[styles.appIconMini, { backgroundColor: themeColors.overlay }]}>
                  <Text style={styles.appIconText}>🤖</Text>
                </View>
              </View>
            </View>

            <View style={[styles.stepConnector, { backgroundColor: themeColors.border }]} />
            
            <View style={styles.step}>
              <View style={styles.stepNumberContainer}>
                <LinearGradient
                  colors={[themeColors.primary, themeColors.secondary]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.stepNumber}
                >
                  <Text style={themeStyles.stepNumberText}>4</Text>
                </LinearGradient>
              </View>
              <View style={styles.stepContent}>
                <Text style={themeStyles.stepTitle}>Auto-Categorized!</Text>
                <Text style={themeStyles.stepDesc}>AI sorts it into the right category</Text>
              </View>
              <View style={styles.stepIcon}>
                <Ionicons name="sparkles" size={24} color={themeColors.primary} />
              </View>
            </View>
          </View>

          {/* AI Info */}
          <View style={[styles.aiInfo, { backgroundColor: `${themeColors.primary}15` }]}>
            <View style={styles.aiInfoHeader}>
              <Ionicons name="sparkles" size={20} color={themeColors.primary} />
              <Text style={[styles.aiInfoTitle, { color: themeColors.primary }]}>AI Auto-Categorization</Text>
            </View>
            <Text style={[styles.aiInfoText, { color: themeColors.textSecondary }]}>
              Our AI analyzes video content, audio, hashtags, and captions to automatically 
              sort videos into categories like Food, Travel, Fitness, Fashion, and more.
            </Text>
          </View>

          {/* Tip */}
          <View style={[styles.tipContainer, { backgroundColor: `${themeColors.warning}15` }]}>
            <Ionicons name="bulb" size={20} color={themeColors.warning} />
            <Text style={[styles.tipText, { color: themeColors.textSecondary }]}>
              Tip: You can share multiple videos quickly! They'll all be processed and categorized automatically.
            </Text>
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    padding: Spacing.xl,
    paddingBottom: Spacing.xxxl,
  },
  devSection: {
    backgroundColor: `${Colors.warning}15`,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: `${Colors.warning}30`,
  },
  devHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  devLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.warning,
  },
  urlInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.md,
  },
  urlInput: {
    flex: 1,
    paddingVertical: Spacing.md,
    fontSize: 14,
    color: Colors.text,
  },
  clearBtn: {
    padding: Spacing.xs,
  },
  importBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  importBtnDisabled: {
    opacity: 0.4,
  },
  importBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: Spacing.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  dividerText: {
    paddingHorizontal: Spacing.md,
    fontSize: 12,
    color: Colors.textQuaternary,
  },
  statusCard: {
    alignItems: 'center',
    padding: Spacing.xxl,
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: BorderRadius.xl,
    marginBottom: Spacing.xl,
  },
  successCard: {
    backgroundColor: `${Colors.success}15`,
  },
  errorCard: {
    backgroundColor: `${Colors.error}15`,
  },
  statusText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    marginTop: Spacing.lg,
  },
  statusSubtext: {
    fontSize: 14,
    color: Colors.textTertiary,
    marginTop: Spacing.xs,
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: Spacing.xxl,
  },
  heroIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  heroEmoji: {
    fontSize: 48,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  heroSubtitle: {
    fontSize: 15,
    color: Colors.textTertiary,
    textAlign: 'center',
  },
  stepsContainer: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    marginBottom: Spacing.xl,
  },
  stepsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.xl,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepNumberContainer: {
    marginRight: Spacing.md,
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumberText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  stepDesc: {
    fontSize: 13,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  stepIcon: {
    width: 40,
    alignItems: 'center',
  },
  stepEmoji: {
    fontSize: 24,
  },
  stepConnector: {
    width: 2,
    height: 24,
    backgroundColor: Colors.border,
    marginLeft: 15,
    marginVertical: Spacing.sm,
  },
  appIconMini: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
  appIconText: {
    fontSize: 18,
  },
  aiInfo: {
    backgroundColor: `${Colors.primary}15`,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  aiInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  aiInfoTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.primary,
  },
  aiInfoText: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  tipContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    backgroundColor: `${Colors.warning}15`,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
  },
  tipText: {
    flex: 1,
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
});
