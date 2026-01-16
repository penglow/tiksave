import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  Linking,
  Platform,
  Modal,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { useNavigation } from '@react-navigation/native';
import type { MainTabScreenProps } from '../navigation/types';

import { Colors, Spacing, BorderRadius } from '../config';
import { AppTheme, Folder, getDisplayIcon } from '../types';
import { useAuthStore } from '../stores/authStore';
import { useAppStore } from '../stores/appStore';
import { apiService } from '../services/api';
import { useTheme } from '../hooks/useTheme';

const APP_VERSION = '1.0.0';

export default function SettingsScreen() {
  const signOut = useAuthStore((state) => state.signOut);
  const { userSettings, updateUserSettings } = useAppStore();
  const { colors: themeColors } = useTheme();
  // #region agent log
  React.useEffect(() => {
    fetch('http://127.0.0.1:7242/ingest/e4b12369-f4da-44c9-b8ec-020b4285b184',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'SettingsScreen.tsx:32',message:'SettingsScreen render with theme',data:{backgroundColor:themeColors.background},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'F'})}).catch(()=>{});
  }, [themeColors.background]);
  // #endregion
  const [thumbnailCacheSize] = useState('0.0 MB');
  const [showFoldersModal, setShowFoldersModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [foldersLoading, setFoldersLoading] = useState(false);
  const navigation = useNavigation<any>();

  const loadFolders = async () => {
    setFoldersLoading(true);
    try {
      const data = await apiService.getFolders();
      setFolders(data);
    } catch (error) {
      console.error('Failed to load folders:', error);
    } finally {
      setFoldersLoading(false);
    }
  };

  const handleOpenFolders = () => {
    loadFolders();
    setShowFoldersModal(true);
  };

  const handleCreateFolder = async (name: string, parentId?: string, iconName?: string) => {
    try {
      await apiService.createFolder(name, parentId, iconName);
      loadFolders();
      setShowCreateModal(false);
    } catch (error) {
      console.error('Failed to create folder:', error);
      if (Platform.OS === 'web') {
        window.alert('Failed to create collection. Please try again.');
      } else {
        Alert.alert('Error', 'Failed to create collection. Please try again.');
      }
    }
  };

  const handleDeleteFolder = async (folder: Folder) => {
    const confirmMessage = `Delete "${folder.name}"? Videos in this folder will be moved back to your library.`;
    
    if (Platform.OS === 'web') {
      const confirmed = window.confirm(confirmMessage);
      if (confirmed) {
        try {
          await apiService.deleteFolder(folder.id);
          loadFolders();
        } catch (error) {
          console.error('Failed to delete folder:', error);
          window.alert('Failed to delete folder. Please try again.');
        }
      }
    } else {
      Alert.alert('Delete Folder', confirmMessage, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiService.deleteFolder(folder.id);
              loadFolders();
            } catch (error) {
              console.error('Failed to delete folder:', error);
              Alert.alert('Error', 'Failed to delete folder. Please try again.');
            }
          },
        },
      ]);
    }
  };

  const handleSignOut = async () => {
    if (Platform.OS === 'web') {
      // Use browser's confirm dialog on web since Alert.alert doesn't work properly
      const confirmed = window.confirm('Are you sure you want to sign out?');
      if (confirmed) {
        await signOut();
      }
    } else {
      Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await signOut();
          },
        },
      ]);
    }
  };

  const handleDeleteData = () => {
    if (Platform.OS === 'web') {
      const confirmed = window.confirm(
        'Delete All Data?\n\nThis will permanently delete all your saved videos, folders, and learning data. This action cannot be undone.'
      );
      if (confirmed) {
        // TODO: Implement data deletion
        window.alert('All data has been deleted.');
      }
    } else {
      Alert.alert(
        'Delete All Data?',
        'This will permanently delete all your saved videos, folders, and learning data. This action cannot be undone.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => {
              // TODO: Implement data deletion
              Alert.alert('Success', 'All data has been deleted.');
            },
          },
        ]
      );
    }
  };

  const handleClearCache = () => {
    if (Platform.OS === 'web') {
      window.alert('Thumbnail cache cleared.');
    } else {
      Alert.alert('Success', 'Thumbnail cache cleared.');
    }
  };

  const openLink = (url: string) => {
    Linking.openURL(url);
  };

  // Create theme-aware styles
  const themeStyles = React.useMemo(() => ({
    sectionHeader: { ...styles.sectionHeader, color: themeColors.textTertiary },
    sectionFooter: { ...styles.sectionFooter, color: themeColors.textQuaternary },
    settingRow: { ...styles.settingRow, backgroundColor: themeColors.overlayLight },
    settingRowVertical: { ...styles.settingRowVertical, backgroundColor: themeColors.overlayLight },
    settingLabel: { ...styles.settingLabel, color: themeColors.text },
    settingValue: { ...styles.settingValue, color: themeColors.textTertiary },
    themeOption: { ...styles.themeOption, backgroundColor: themeColors.overlay },
    themeOptionText: { ...styles.themeOptionText, color: themeColors.textSecondary },
    themeOptionTextSelected: { ...styles.themeOptionTextSelected, color: themeColors.text },
    settingDescription: { ...styles.settingDescription, color: themeColors.textTertiary },
    modalContent: { ...styles.modalContent, backgroundColor: themeColors.backgroundSecondary },
    modalTitle: { ...styles.modalTitle, color: themeColors.text },
    modalSubtitle: { ...styles.modalSubtitle, color: themeColors.textTertiary },
    loadingText: { ...styles.loadingText, color: themeColors.textTertiary },
    emptyFoldersText: { ...styles.emptyFoldersText, color: themeColors.text },
    emptyFoldersSubtext: { ...styles.emptyFoldersSubtext, color: themeColors.textTertiary },
    folderItem: { ...styles.folderItem, borderBottomColor: themeColors.border },
    folderName: { ...styles.folderName, color: themeColors.text },
    folderCount: { ...styles.folderCount, color: themeColors.textTertiary },
    createFolderButton: { ...styles.createFolderButton, backgroundColor: themeColors.overlay },
    createFolderText: { ...styles.createFolderText, color: themeColors.text },
  }), [themeColors]);

  return (
    <ScrollView style={[styles.container, { backgroundColor: themeColors.background }]} contentContainerStyle={styles.content}>
      {/* Processing Section */}
      <View style={styles.section}>
        <Text style={themeStyles.sectionHeader}>PROCESSING</Text>

        <View style={themeStyles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={themeStyles.settingLabel}>Enable Video Upload</Text>
          </View>
          <Switch
            value={userSettings.enableVideoUpload}
            onValueChange={(value) => updateUserSettings({ enableVideoUpload: value })}
            trackColor={{ false: themeColors.overlay, true: themeColors.primary }}
            thumbColor={themeColors.text}
          />
        </View>

        <View style={themeStyles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={themeStyles.settingLabel}>Auto-file High Confidence</Text>
          </View>
          <Switch
            value={userSettings.autoFileHighConfidence}
            onValueChange={(value) => updateUserSettings({ autoFileHighConfidence: value })}
            trackColor={{ false: themeColors.overlay, true: themeColors.primary }}
            thumbColor={themeColors.text}
          />
        </View>

        <View style={themeStyles.settingRowVertical}>
          <View style={styles.settingRowTop}>
            <Text style={themeStyles.settingLabel}>Confidence Threshold</Text>
            <Text style={themeStyles.settingValue}>
              {Math.round(userSettings.confidenceThreshold * 100)}%
            </Text>
          </View>
          <Slider
            style={styles.slider}
            value={userSettings.confidenceThreshold}
            onValueChange={(value) => updateUserSettings({ confidenceThreshold: value })}
            minimumValue={0.5}
            maximumValue={0.95}
            step={0.05}
            minimumTrackTintColor={themeColors.primary}
            maximumTrackTintColor={themeColors.overlay}
            thumbTintColor={themeColors.primary}
          />
        </View>

        <Text style={themeStyles.sectionFooter}>
          Video upload enables richer AI analysis. Without it, classification uses only shared
          text and URL.
        </Text>
      </View>

      {/* Organization Section - Optional Manual Folders */}
      <View style={styles.section}>
        <Text style={themeStyles.sectionHeader}>ORGANIZATION (OPTIONAL)</Text>

        <TouchableOpacity style={themeStyles.settingRow} onPress={handleOpenFolders}>
          <View style={styles.settingIconRow}>
            <View style={styles.settingIconContainer}>
              <Ionicons name="folder" size={20} color={themeColors.secondary} />
            </View>
            <View style={styles.settingInfo}>
              <Text style={themeStyles.settingLabel}>My Collections</Text>
              <Text style={themeStyles.settingDescription}>Create custom folders for manual organization</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color={themeColors.textQuaternary} />
        </TouchableOpacity>

        <Text style={themeStyles.sectionFooter}>
          AI automatically categorizes your videos. Use collections for additional personal organization.
        </Text>
      </View>

      {/* Appearance Section */}
      <View style={styles.section}>
        <Text style={themeStyles.sectionHeader}>APPEARANCE</Text>

        <TouchableOpacity style={themeStyles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={themeStyles.settingLabel}>Theme</Text>
          </View>
          <View style={styles.themeSelector}>
            {(['light', 'dark', 'system'] as AppTheme[]).map((theme) => (
              <TouchableOpacity
                key={theme}
                style={[
                  themeStyles.themeOption,
                  userSettings.theme === theme && styles.themeOptionSelected,
                ]}
                onPress={() => {
                  // #region agent log
                  fetch('http://127.0.0.1:7242/ingest/e4b12369-f4da-44c9-b8ec-020b4285b184',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'SettingsScreen.tsx:259',message:'Theme button pressed',data:{theme,currentTheme:userSettings.theme},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
                  // #endregion
                  updateUserSettings({ theme });
                }}
              >
                <Text
                  style={[
                    themeStyles.themeOptionText,
                    userSettings.theme === theme && themeStyles.themeOptionTextSelected,
                  ]}
                >
                  {theme.charAt(0).toUpperCase() + theme.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>

        <View style={themeStyles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={themeStyles.settingLabel}>Notifications</Text>
          </View>
          <Switch
            value={userSettings.notificationsEnabled}
            onValueChange={(value) => updateUserSettings({ notificationsEnabled: value })}
            trackColor={{ false: themeColors.overlay, true: themeColors.primary }}
            thumbColor={themeColors.text}
          />
        </View>
      </View>

      {/* Storage Section */}
      <View style={styles.section}>
        <Text style={themeStyles.sectionHeader}>STORAGE</Text>

        <View style={themeStyles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={themeStyles.settingLabel}>Cached Thumbnails</Text>
          </View>
          <Text style={themeStyles.settingValue}>{thumbnailCacheSize}</Text>
        </View>

        <TouchableOpacity style={themeStyles.settingRow} onPress={handleClearCache}>
          <Text style={styles.settingLabelWarning}>Clear Thumbnail Cache</Text>
        </TouchableOpacity>
      </View>

      {/* Data & Privacy Section */}
      <View style={styles.section}>
        <Text style={themeStyles.sectionHeader}>DATA & PRIVACY</Text>

        <TouchableOpacity
          style={themeStyles.settingRow}
          onPress={() => openLink('https://yourapp.com/privacy')}
        >
          <Text style={themeStyles.settingLabel}>Privacy Policy</Text>
          <Ionicons name="chevron-forward" size={18} color={themeColors.textQuaternary} />
        </TouchableOpacity>

        <TouchableOpacity style={themeStyles.settingRow}>
          <Text style={themeStyles.settingLabel}>Export My Data</Text>
          <Ionicons name="chevron-forward" size={18} color={themeColors.textQuaternary} />
        </TouchableOpacity>

        <TouchableOpacity style={themeStyles.settingRow} onPress={handleDeleteData}>
          <Text style={styles.settingLabelDanger}>Delete All My Data</Text>
        </TouchableOpacity>

        <Text style={themeStyles.sectionFooter}>
          Deleting your data removes all saved videos, folders, and learning data permanently.
        </Text>
      </View>

      {/* About Section */}
      <View style={styles.section}>
        <Text style={themeStyles.sectionHeader}>ABOUT</Text>

        <View style={themeStyles.settingRow}>
          <Text style={themeStyles.settingLabel}>Version</Text>
          <Text style={themeStyles.settingValue}>{APP_VERSION}</Text>
        </View>

        <TouchableOpacity
          style={themeStyles.settingRow}
          onPress={() => openLink('https://yourapp.com/support')}
        >
          <Text style={themeStyles.settingLabel}>Support</Text>
          <Ionicons name="arrow-forward" size={14} color={themeColors.textQuaternary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={themeStyles.settingRow}
          onPress={() => openLink('https://yourapp.com/feedback')}
        >
          <Text style={themeStyles.settingLabel}>Send Feedback</Text>
          <Ionicons name="arrow-forward" size={14} color={themeColors.textQuaternary} />
        </TouchableOpacity>
      </View>

      {/* Account Section */}
      <View style={styles.section}>
        <Text style={themeStyles.sectionHeader}>ACCOUNT</Text>

        <TouchableOpacity style={themeStyles.settingRow} onPress={handleSignOut}>
          <Text style={styles.settingLabelDanger}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      {/* My Collections Modal */}
      <Modal
        visible={showFoldersModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowFoldersModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: themeColors.backgroundSecondary }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>My Collections</Text>
              <TouchableOpacity onPress={() => setShowFoldersModal(false)}>
                <Ionicons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.modalSubtitle}>
              Optional: Create personal collections for custom organization
            </Text>

            {foldersLoading ? (
              <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>Loading...</Text>
              </View>
            ) : folders.length === 0 ? (
              <View style={styles.emptyFolders}>
                <Ionicons name="folder-open" size={40} color={Colors.textQuaternary} />
                <Text style={styles.emptyFoldersText}>No collections yet</Text>
                <Text style={styles.emptyFoldersSubtext}>
                  AI categories handle organization automatically.{'\n'}
                  Create collections for additional grouping.
                </Text>
              </View>
            ) : (
              <ScrollView style={styles.foldersList}>
                {folders.map((folder) => (
                  <TouchableOpacity
                    key={folder.id}
                    style={[styles.folderItem, { borderBottomColor: themeColors.border }]}
                    onPress={() => {
                      setShowFoldersModal(false);
                      // Navigate to FolderDetail in LibraryStack
                      (navigation as any).navigate('Library', { 
                        screen: 'FolderDetail', 
                        params: { folder } 
                      });
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.folderIcon}>{getDisplayIcon(folder) || '📁'}</Text>
                    <View style={styles.folderInfo}>
                      <Text style={themeStyles.folderName}>{folder.name}</Text>
                      <Text style={themeStyles.folderCount}>{folder.itemCount} videos</Text>
                    </View>
                    <TouchableOpacity 
                      style={styles.folderDeleteButton}
                      onPress={(e) => {
                        e.stopPropagation();
                        handleDeleteFolder(folder);
                      }}
                    >
                      <Ionicons name="trash-outline" size={18} color={themeColors.error} />
                    </TouchableOpacity>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            <TouchableOpacity 
              style={themeStyles.createFolderButton}
              onPress={() => {
                setShowCreateModal(true);
              }}
            >
              <Ionicons name="add" size={20} color={themeColors.text} />
              <Text style={themeStyles.createFolderText}>Create Collection</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Create Folder Modal */}
      <CreateFolderModal
        visible={showCreateModal}
        folders={folders}
        onClose={() => setShowCreateModal(false)}
        onCreate={handleCreateFolder}
      />
    </ScrollView>
  );
}

// Create Folder Modal Component
function CreateFolderModal({
  visible,
  folders,
  onClose,
  onCreate,
}: {
  visible: boolean;
  folders: Folder[];
  onClose: () => void;
  onCreate: (name: string, parentId?: string, iconName?: string) => void;
}) {
  const { colors: themeColors } = useTheme();
  const [name, setName] = React.useState('');
  const [selectedIcon, setSelectedIcon] = React.useState('📁');
  const [selectedParentId, setSelectedParentId] = React.useState<string | undefined>();

  const availableIcons = [
    '📁', '🇯🇵', '🇰🇷', '🇺🇸', '🇬🇧', '🍽️', '🏨', '🎡', '🛍️', '💪',
    '🚗', '💰', '📱', '👗', '💄', '🐾', '🎵', '📚',
  ];

  const handleCreate = () => {
    if (name.trim()) {
      onCreate(name.trim(), selectedParentId, selectedIcon);
      setName('');
      setSelectedIcon('📁');
      setSelectedParentId(undefined);
    }
  };

  const topLevelFolders = folders.filter((f) => !f.parentId);

  return (
      <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
        <View style={createModalStyles.overlay}>
          <View style={[createModalStyles.container, { backgroundColor: themeColors.backgroundSecondary }]}>
          <View style={createModalStyles.header}>
            <Text style={createModalStyles.title}>New Collection</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={Colors.text} />
            </TouchableOpacity>
          </View>

          {/* Icon Selector */}
          <Text style={createModalStyles.label}>Icon</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={createModalStyles.iconScroll}>
            {availableIcons.map((icon) => (
              <TouchableOpacity
                key={icon}
                style={[
                  createModalStyles.iconOption,
                  selectedIcon === icon && createModalStyles.iconOptionSelected,
                ]}
                onPress={() => setSelectedIcon(icon)}
              >
                <Text style={createModalStyles.iconText}>{icon}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Name Input */}
          <Text style={createModalStyles.label}>Name</Text>
          <TextInput
            style={createModalStyles.input}
            placeholder="Collection name"
            placeholderTextColor={Colors.textQuaternary}
            value={name}
            onChangeText={setName}
            autoFocus
          />

          {/* Parent Folder */}
          {topLevelFolders.length > 0 && (
            <>
              <Text style={createModalStyles.label}>Parent Collection (optional)</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={createModalStyles.parentScroll}>
                <TouchableOpacity
                  style={[
                    createModalStyles.parentOption,
                    !selectedParentId && createModalStyles.parentOptionSelected,
                  ]}
                  onPress={() => setSelectedParentId(undefined)}
                >
                  <Text style={createModalStyles.parentText}>None (Top Level)</Text>
                </TouchableOpacity>
                {topLevelFolders.map((folder) => (
                  <TouchableOpacity
                    key={folder.id}
                    style={[
                      createModalStyles.parentOption,
                      selectedParentId === folder.id && createModalStyles.parentOptionSelected,
                    ]}
                    onPress={() => setSelectedParentId(folder.id)}
                  >
                    <Text style={createModalStyles.parentText}>{folder.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </>
          )}

          {/* Actions */}
          <View style={createModalStyles.actions}>
            <TouchableOpacity style={createModalStyles.cancelButton} onPress={onClose}>
              <Text style={createModalStyles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[createModalStyles.createButton, !name.trim() && createModalStyles.createButtonDisabled]}
              onPress={handleCreate}
              disabled={!name.trim()}
            >
              <Text style={createModalStyles.createText}>Create</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const createModalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: Colors.backgroundSecondary,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: Spacing.xl,
    paddingBottom: 40,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.text,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textTertiary,
    marginBottom: Spacing.sm,
    marginTop: Spacing.lg,
  },
  iconScroll: {
    flexGrow: 0,
  },
  iconOption: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.overlay,
    borderRadius: BorderRadius.md,
    marginRight: Spacing.sm,
  },
  iconOptionSelected: {
    backgroundColor: `${Colors.primary}4D`,
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  iconText: {
    fontSize: 22,
  },
  input: {
    backgroundColor: Colors.overlay,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    fontSize: 16,
    color: Colors.text,
  },
  parentScroll: {
    flexGrow: 0,
  },
  parentOption: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    backgroundColor: Colors.overlay,
    borderRadius: BorderRadius.full,
    marginRight: Spacing.sm,
  },
  parentOptionSelected: {
    backgroundColor: `${Colors.primary}4D`,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  parentText: {
    fontSize: 14,
    color: Colors.text,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.xxl,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  cancelText: {
    color: Colors.text,
    fontSize: 16,
  },
  createButton: {
    flex: 1,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  createButtonDisabled: {
    opacity: 0.5,
  },
  createText: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxxl,
  },
  section: {
    marginBottom: Spacing.xxl,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textTertiary,
    letterSpacing: 0.5,
    marginBottom: Spacing.md,
    marginLeft: Spacing.sm,
  },
  sectionFooter: {
    fontSize: 12,
    color: Colors.textQuaternary,
    marginTop: Spacing.md,
    marginLeft: Spacing.sm,
    lineHeight: 18,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.overlayLight,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: 2,
  },
  settingRowVertical: {
    backgroundColor: Colors.overlayLight,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: 2,
  },
  settingRowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  settingInfo: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 15,
    color: Colors.text,
  },
  settingLabelWarning: {
    fontSize: 15,
    color: Colors.warning,
  },
  settingLabelDanger: {
    fontSize: 15,
    color: Colors.error,
  },
  settingValue: {
    fontSize: 15,
    color: Colors.textTertiary,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  themeSelector: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  themeOption: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.overlay,
  },
  themeOptionSelected: {
    backgroundColor: Colors.primary,
  },
  themeOptionText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  themeOptionTextSelected: {
    color: Colors.text,
    fontWeight: '600',
  },
  settingIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingIconContainer: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.sm,
    backgroundColor: `${Colors.secondary}20`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  settingDescription: {
    fontSize: 12,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.backgroundSecondary,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: Spacing.xl,
    paddingBottom: 40,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.text,
  },
  modalSubtitle: {
    fontSize: 13,
    color: Colors.textTertiary,
    marginBottom: Spacing.lg,
  },
  loadingContainer: {
    padding: Spacing.xxl,
    alignItems: 'center',
  },
  loadingText: {
    color: Colors.textTertiary,
    fontSize: 14,
  },
  emptyFolders: {
    alignItems: 'center',
    padding: Spacing.xxl,
  },
  emptyFoldersText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginTop: Spacing.lg,
  },
  emptyFoldersSubtext: {
    fontSize: 13,
    color: Colors.textTertiary,
    textAlign: 'center',
    marginTop: Spacing.sm,
    lineHeight: 20,
  },
  foldersList: {
    maxHeight: 300,
  },
  folderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  folderIcon: {
    fontSize: 24,
    marginRight: Spacing.md,
  },
  folderInfo: {
    flex: 1,
  },
  folderName: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.text,
  },
  folderCount: {
    fontSize: 12,
    color: Colors.textTertiary,
  },
  folderDeleteButton: {
    padding: Spacing.sm,
    marginLeft: Spacing.sm,
  },
  createFolderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.overlay,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.lg,
  },
  createFolderText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
  },
});

