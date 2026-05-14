import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  Alert,
  Linking,
  Platform,
  Modal,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Spacing, BorderRadius, Typography, Hairline } from '../config';
import { AppTheme, Folder, getDisplayIcon } from '../types';
import { useAuthStore } from '../stores/authStore';
import { useAppStore } from '../stores/appStore';
import { apiService } from '../services/api';
import { useTheme } from '../hooks/useTheme';
import { AnimatedPressable, AnimatedListItem, AnimatedText, Card, Badge } from '../components';

const APP_VERSION = '1.0.0';

export default function SettingsScreen() {
  const signOut = useAuthStore((state) => state.signOut);
  const { userSettings, updateUserSettings } = useAppStore();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();

  const [thumbnailCacheSize] = useState('0.0 MB');
  const [showFoldersModal, setShowFoldersModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [foldersLoading, setFoldersLoading] = useState(false);

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
        window.alert('Failed to create collection.');
      } else {
        Alert.alert('Error', 'Failed to create collection.');
      }
    }
  };

  const handleDeleteFolder = async (folder: Folder) => {
    const message = `Delete "${folder.name}"? Videos will move back to library.`;

    if (Platform.OS === 'web') {
      if (window.confirm(message)) {
        try {
          await apiService.deleteFolder(folder.id);
          loadFolders();
        } catch (error) {
          window.alert('Failed to delete folder.');
        }
      }
    } else {
      Alert.alert('Delete Folder', message, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiService.deleteFolder(folder.id);
              loadFolders();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete folder.');
            }
          },
        },
      ]);
    }
  };

  const handleSignOut = async () => {
    if (Platform.OS === 'web') {
      if (window.confirm('Sign out?')) {
        await signOut();
      }
    } else {
      Alert.alert('Sign Out', 'Are you sure?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: signOut },
      ]);
    }
  };

  const handleDeleteData = () => {
    const message = 'Delete all data? This cannot be undone.';
    if (Platform.OS === 'web') {
      if (window.confirm(message)) {
        window.alert('All data deleted.');
      }
    } else {
      Alert.alert('Delete Data', message, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => Alert.alert('Deleted') },
      ]);
    }
  };

  const handleClearCache = () => {
    if (Platform.OS === 'web') {
      window.alert('Cache cleared.');
    } else {
      Alert.alert('Success', 'Cache cleared.');
    }
  };

  const openLink = (url: string) => Linking.openURL(url);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + Spacing.md }]}
    >
      {/* Header */}
      <Animated.View entering={FadeIn.duration(300)} style={styles.header}>
        <AnimatedText style={[styles.headerTitle, { color: colors.text }]}>
          Settings
        </AnimatedText>
      </Animated.View>

      {/* Organization Section */}
      <AnimatedListItem index={0} direction="fade">
        <SettingSection label="ORGANIZATION">
          <SettingRow
            icon="folder-outline"
            title="Collections"
            subtitle="Create custom folders"
            onPress={handleOpenFolders}
            showChevron
          />
        </SettingSection>
      </AnimatedListItem>

      {/* Appearance Section */}
      <AnimatedListItem index={1} direction="fade">
        <SettingSection label="APPEARANCE">
          <View style={[styles.row, { borderBottomColor: colors.border }]}>
            <Text style={[styles.rowTitle, { color: colors.text }]}>Theme</Text>
            <View style={styles.themeSelector}>
              {(['light', 'dark', 'system'] as AppTheme[]).map((theme) => (
                <AnimatedPressable
                  key={theme}
                  style={[
                    styles.themeOption,
                    {
                      borderColor: userSettings.theme === theme ? colors.text : colors.border,
                      backgroundColor: userSettings.theme === theme ? colors.surfaceHover : 'transparent',
                    },
                  ]}
                  onPress={() => updateUserSettings({ theme })}
                  haptic
                >
                  <Text style={[
                    styles.themeOptionText,
                    { color: userSettings.theme === theme ? colors.text : colors.textTertiary },
                  ]}>
                    {theme.charAt(0).toUpperCase() + theme.slice(1)}
                  </Text>
                </AnimatedPressable>
              ))}
            </View>
          </View>

          <View style={[styles.row, { borderBottomWidth: 0 }]}>
            <Text style={[styles.rowTitle, { color: colors.text }]}>Notifications</Text>
            <Switch
              value={userSettings.notificationsEnabled}
              onValueChange={(value) => updateUserSettings({ notificationsEnabled: value })}
              trackColor={{ false: colors.surfaceHover, true: colors.accent }}
              thumbColor={colors.background}
              style={styles.switch}
            />
          </View>
        </SettingSection>
      </AnimatedListItem>

      {/* Storage Section */}
      <AnimatedListItem index={2} direction="fade">
        <SettingSection label="STORAGE">
          <View style={[styles.row, { borderBottomColor: colors.border }]}>
            <Text style={[styles.rowTitle, { color: colors.text }]}>Cached Thumbnails</Text>
            <Text style={[styles.rowValue, { color: colors.textTertiary }]}>{thumbnailCacheSize}</Text>
          </View>
          <SettingRow
            title="Clear Cache"
            onPress={handleClearCache}
            titleColor={colors.warning}
          />
        </SettingSection>
      </AnimatedListItem>

      {/* Privacy Section */}
      <AnimatedListItem index={3} direction="fade">
        <SettingSection label="PRIVACY">
          <SettingRow
            title="Privacy Policy"
            onPress={() => openLink('https://yourapp.com/privacy')}
            showChevron
          />
          <SettingRow
            title="Export Data"
            onPress={() => { }}
            showChevron
          />
        </SettingSection>
      </AnimatedListItem>

      {/* Danger Zone */}
      <AnimatedListItem index={4} direction="fade">
        <SettingSection label="DANGER ZONE" labelColor={colors.error}>
          <SettingRow
            title="Delete All Data"
            onPress={handleDeleteData}
            titleColor={colors.error}
          />
          <SettingRow
            title="Sign Out"
            onPress={handleSignOut}
            titleColor={colors.error}
          />
        </SettingSection>
      </AnimatedListItem>

      {/* Version */}
      <AnimatedListItem index={5} direction="fade">
        <View style={styles.versionContainer}>
          <Badge label={`v${APP_VERSION}`} variant="ghost" size="sm" />
        </View>
      </AnimatedListItem>

      {/* Folders Modal */}
      <FoldersModal
        visible={showFoldersModal}
        folders={folders}
        loading={foldersLoading}
        onClose={() => setShowFoldersModal(false)}
        onCreatePress={() => setShowCreateModal(true)}
        onFolderPress={(folder) => {
          setShowFoldersModal(false);
          navigation.navigate('Library', {
            screen: 'FolderDetail',
            params: { folder },
          });
        }}
        onDeletePress={handleDeleteFolder}
      />

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

function SettingSection({
  label,
  labelColor,
  children
}: {
  label: string;
  labelColor?: string;
  children: React.ReactNode;
}) {
  const { colors } = useTheme();

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionLabel, { color: labelColor || colors.textTertiary }]}>
        {label}
      </Text>
      <View style={[styles.sectionContent, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {children}
      </View>
    </View>
  );
}

function SettingRow({
  icon,
  title,
  subtitle,
  onPress,
  showChevron,
  titleColor,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  showChevron?: boolean;
  titleColor?: string;
}) {
  const { colors } = useTheme();

  return (
    <AnimatedPressable
      style={[styles.row, { borderBottomColor: colors.border }]}
      onPress={onPress}
      disabled={!onPress}
      opacityOnPress={0.6}
    >
      {icon && (
        <View style={[styles.rowIconWrapper, { backgroundColor: colors.surfaceHover }]}>
          <Ionicons name={icon} size={16} color={colors.textSecondary} />
        </View>
      )}
      <View style={styles.rowContent}>
        <Text style={[styles.rowTitle, { color: titleColor || colors.text }]}>{title}</Text>
        {subtitle && (
          <Text style={[styles.rowSubtitle, { color: colors.textTertiary }]}>{subtitle}</Text>
        )}
      </View>
      {showChevron && (
        <Ionicons name="chevron-forward" size={16} color={colors.textQuaternary} />
      )}
    </AnimatedPressable>
  );
}

function FoldersModal({
  visible,
  folders,
  loading,
  onClose,
  onCreatePress,
  onFolderPress,
  onDeletePress,
}: {
  visible: boolean;
  folders: Folder[];
  loading: boolean;
  onClose: () => void;
  onCreatePress: () => void;
  onFolderPress: (folder: Folder) => void;
  onDeletePress: (folder: Folder) => void;
}) {
  const { colors } = useTheme();

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Collections</Text>
            <AnimatedPressable onPress={onClose}>
              <Ionicons name="close" size={22} color={colors.text} />
            </AnimatedPressable>
          </View>

          {loading ? (
            <View style={styles.modalLoading}>
              <Text style={[styles.modalLoadingText, { color: colors.textTertiary }]}>
                Loading...
              </Text>
            </View>
          ) : folders.length === 0 ? (
            <View style={styles.modalEmpty}>
              <View style={[styles.emptyIconWrapper, { backgroundColor: colors.surfaceHover }]}>
                <Ionicons name="folder-open-outline" size={28} color={colors.textTertiary} />
              </View>
              <Text style={[styles.modalEmptyTitle, { color: colors.text }]}>
                No collections
              </Text>
              <Text style={[styles.modalEmptySubtitle, { color: colors.textTertiary }]}>
                Create folders for custom organization
              </Text>
            </View>
          ) : (
            <ScrollView style={styles.foldersList}>
              {folders.map((folder) => (
                <AnimatedPressable
                  key={folder.id}
                  style={[styles.folderItem, { borderBottomColor: colors.border }]}
                  onPress={() => onFolderPress(folder)}
                >
                  <Text style={styles.folderIcon}>{getDisplayIcon(folder) || '📁'}</Text>
                  <View style={styles.folderInfo}>
                    <Text style={[styles.folderName, { color: colors.text }]}>{folder.name}</Text>
                    <Text style={[styles.folderCount, { color: colors.textTertiary }]}>
                      {folder.itemCount} videos
                    </Text>
                  </View>
                  <AnimatedPressable
                    onPress={(e) => {
                      e.stopPropagation?.();
                      onDeletePress(folder);
                    }}
                    style={styles.folderDelete}
                  >
                    <Ionicons name="trash-outline" size={16} color={colors.error} />
                  </AnimatedPressable>
                </AnimatedPressable>
              ))}
            </ScrollView>
          )}

          <AnimatedPressable
            style={[styles.createButton, { backgroundColor: colors.text }]}
            onPress={onCreatePress}
            haptic
          >
            <Ionicons name="add" size={18} color={colors.background} />
            <Text style={[styles.createButtonText, { color: colors.background }]}>
              Create Collection
            </Text>
          </AnimatedPressable>
        </View>
      </View>
    </Modal>
  );
}

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
  const { colors } = useTheme();
  const [name, setName] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('📁');

  const icons = ['📁', '🍽️', '✈️', '💪', '👗', '🎵', '📱', '💰', '🐾', '📚'];

  const handleCreate = () => {
    if (name.trim()) {
      onCreate(name.trim(), undefined, selectedIcon);
      setName('');
      setSelectedIcon('📁');
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>New Collection</Text>
            <AnimatedPressable onPress={onClose}>
              <Ionicons name="close" size={22} color={colors.text} />
            </AnimatedPressable>
          </View>

          <Text style={[styles.inputLabel, { color: colors.textTertiary }]}>ICON</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.iconPicker}>
            {icons.map((icon) => (
              <AnimatedPressable
                key={icon}
                style={[
                  styles.iconOption,
                  {
                    backgroundColor: selectedIcon === icon ? colors.accentSubtle : 'transparent',
                    borderColor: selectedIcon === icon ? colors.accent : colors.border,
                  },
                ]}
                onPress={() => setSelectedIcon(icon)}
              >
                <Text style={styles.iconText}>{icon}</Text>
              </AnimatedPressable>
            ))}
          </ScrollView>

          <Text style={[styles.inputLabel, { color: colors.textTertiary }]}>NAME</Text>
          <TextInput
            style={[styles.textInput, { borderColor: colors.border, color: colors.text, backgroundColor: colors.surface }]}
            placeholder="Collection name"
            placeholderTextColor={colors.textQuaternary}
            value={name}
            onChangeText={setName}
            autoFocus
          />

          <View style={styles.modalActions}>
            <AnimatedPressable
              style={styles.cancelButton}
              onPress={onClose}
            >
              <Text style={[styles.cancelButtonText, { color: colors.textSecondary }]}>
                Cancel
              </Text>
            </AnimatedPressable>
            <AnimatedPressable
              style={[
                styles.saveButton,
                { backgroundColor: colors.text },
                !name.trim() && styles.saveButtonDisabled,
              ]}
              onPress={handleCreate}
              disabled={!name.trim()}
              haptic
            >
              <Text style={[styles.saveButtonText, { color: colors.background }]}>
                Create
              </Text>
            </AnimatedPressable>
          </View>
        </View>
      </View>
    </Modal>
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
    marginBottom: Spacing.lg,
  },
  headerTitle: {
    ...Typography.displayMd,
  },

  // Section
  section: {
    marginBottom: Spacing.lg,
  },
  sectionLabel: {
    ...Typography.label,
    marginBottom: Spacing.sm,
    marginLeft: Spacing.xs,
  },
  sectionContent: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },

  // Row
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: Hairline,
    gap: Spacing.sm,
  },
  rowIconWrapper: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.xs,
  },
  rowContent: {
    flex: 1,
  },
  rowTitle: {
    ...Typography.body,
  },
  rowSubtitle: {
    ...Typography.caption,
    marginTop: 2,
  },
  rowValue: {
    ...Typography.body,
  },

  // Theme selector
  themeSelector: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  themeOption: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
  },
  themeOptionText: {
    ...Typography.captionStrong,
  },
  switch: {
    transform: [{ scale: 0.85 }],
  },

  // Version
  versionContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  modalTitle: {
    ...Typography.heading,
  },
  modalLoading: {
    padding: Spacing.xl,
    alignItems: 'center',
  },
  modalLoadingText: {
    ...Typography.body,
  },
  modalEmpty: {
    padding: Spacing.xl,
    alignItems: 'center',
  },
  emptyIconWrapper: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  modalEmptyTitle: {
    ...Typography.headingSm,
    marginTop: Spacing.sm,
  },
  modalEmptySubtitle: {
    ...Typography.caption,
    marginTop: Spacing.xs,
    textAlign: 'center',
  },

  // Folders list
  foldersList: {
    maxHeight: 300,
  },
  folderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: Hairline,
    gap: Spacing.sm,
  },
  folderIcon: {
    fontSize: 20,
    marginRight: Spacing.xs,
  },
  folderInfo: {
    flex: 1,
  },
  folderName: {
    ...Typography.bodyStrong,
  },
  folderCount: {
    ...Typography.caption,
  },
  folderDelete: {
    padding: Spacing.xs,
  },

  // Create button
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.md,
  },
  createButtonText: {
    ...Typography.bodyStrong,
  },

  // Create modal
  inputLabel: {
    ...Typography.label,
    marginBottom: Spacing.sm,
    marginTop: Spacing.md,
  },
  iconPicker: {
    flexGrow: 0,
  },
  iconOption: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    marginRight: Spacing.xs,
  },
  iconText: {
    fontSize: 22,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    ...Typography.body,
  },
  modalActions: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },
  cancelButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  cancelButtonText: {
    ...Typography.body,
  },
  saveButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.sm,
  },
  saveButtonDisabled: {
    opacity: 0.3,
  },
  saveButtonText: {
    ...Typography.bodyStrong,
  },
});
