/**
 * FoldersScreen
 *
 * Hierarchical folder browser in the Folders tab. Loads user folders on focus,
 * navigates to `FolderDetail` on selection, and supports create-folder via modal.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Modal,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Spacing, BorderRadius, Typography, Hairline, Shadows, TAB_BAR_OVERLAP } from '../config';
import { Folder, FolderNode } from '../types';
import { apiService } from '../services/api';
import { FoldersStackScreenProps } from '../navigation/types';
import { useTheme } from '../hooks/useTheme';
import { AnimatedPressable, AnimatedListItem } from '../components';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type Props = FoldersStackScreenProps<'FoldersList'>;

// -----------------------------------------------------------------------------
// Helpers — flat folder list → tree for UI
// -----------------------------------------------------------------------------

function buildFolderTree(folders: Folder[]): FolderNode[] {
  const topLevel = folders.filter((f) => !f.parentId);

  const buildNode = (folder: Folder): FolderNode => {
    const children = folders
      .filter((f) => f.parentId === folder.id)
      .map(buildNode)
      .sort((a, b) => a.folder.sortOrder - b.folder.sortOrder);

    return { folder, children };
  };

  return topLevel.map(buildNode).sort((a, b) => a.folder.sortOrder - b.folder.sortOrder);
}

// -----------------------------------------------------------------------------
// Main screen
// -----------------------------------------------------------------------------

export default function FoldersScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  // --- List & modal state -----------------------------------------------------

  const [folders, setFolders] = useState<Folder[]>([]);
  const [folderNodes, setFolderNodes] = useState<FolderNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  // --- Data loading -----------------------------------------------------------

  const loadFolders = useCallback(async () => {
    try {
      const data = await apiService.getFolders();
      setFolders(data);
      setFolderNodes(buildFolderTree(data));
    } catch (error) {
      console.error('Failed to load folders:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadFolders();
    }, [loadFolders]),
  );

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    loadFolders();
  }, [loadFolders]);

  const handleCreateFolder = useCallback(
    async (name: string, parentId?: string, iconName?: string) => {
      try {
        await apiService.createFolder(name, parentId, iconName);
        loadFolders();
      } catch (error) {
        console.error('Failed to create folder:', error);
      }
    },
    [loadFolders],
  );

  const openAddModal = useCallback(() => setShowAddModal(true), []);
  const closeAddModal = useCallback(() => setShowAddModal(false), []);

  const navigateToFolderDetail = useCallback(
    (folder: Folder) => {
      navigation.navigate('FolderDetail', { folder });
    },
    [navigation],
  );

  // --- Render -----------------------------------------------------------------

  if (isLoading) {
    return <FoldersLoadingView backgroundColor={colors.background} />;
  }

  if (folderNodes.length === 0) {
    return (
      <View
        style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}
      >
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Folders</Text>
        </View>

        <FoldersEmptyView
          accentSubtleColor={colors.accentSubtle}
          accentColor={colors.accent}
          textColor={colors.text}
          subtitleColor={colors.textTertiary}
          buttonBackgroundColor={colors.text}
          buttonForegroundColor={colors.background}
          onCreatePress={openAddModal}
        />

        <AddFolderModal
          visible={showAddModal}
          folders={folders}
          onClose={closeAddModal}
          onCreate={handleCreateFolder}
        />
      </View>
    );
  }

  return (
    <View
      style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Folders</Text>
          <Text style={[styles.headerCount, { color: colors.textTertiary }]}>
            {folders.length} folder{folders.length !== 1 ? 's' : ''}
          </Text>
        </View>
        <AnimatedPressable
          style={[styles.addButton, { backgroundColor: colors.text }]}
          onPress={openAddModal}
          haptic
        >
          <Ionicons name="add" size={18} color={colors.background} />
        </AnimatedPressable>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.text}
          />
        }
      >
        {folderNodes.map((node, index) => (
          <AnimatedListItem key={node.folder.id} index={index} direction="fade">
            <FolderNodeView node={node} onSelect={navigateToFolderDetail} />
          </AnimatedListItem>
        ))}
      </ScrollView>

      <AddFolderModal
        visible={showAddModal}
        folders={folders}
        onClose={closeAddModal}
        onCreate={handleCreateFolder}
      />
    </View>
  );
}

// -----------------------------------------------------------------------------
// Presentational subviews (loading / empty)
// -----------------------------------------------------------------------------

function FoldersLoadingView({ backgroundColor }: { backgroundColor: string }) {
  const { colors } = useTheme();

  return (
    <View style={[styles.loadingContainer, { backgroundColor }]}>
      <ActivityIndicator size="small" color={colors.text} />
    </View>
  );
}

function FoldersEmptyView({
  accentSubtleColor,
  accentColor,
  textColor,
  subtitleColor,
  buttonBackgroundColor,
  buttonForegroundColor,
  onCreatePress,
}: {
  accentSubtleColor: string;
  accentColor: string;
  textColor: string;
  subtitleColor: string;
  buttonBackgroundColor: string;
  buttonForegroundColor: string;
  onCreatePress: () => void;
}) {
  return (
    <Animated.View entering={FadeIn.duration(300)} style={styles.emptyContainer}>
      <View style={[styles.emptyIconWrapper, { backgroundColor: accentSubtleColor }]}>
        <Ionicons name="folder-open-outline" size={32} color={accentColor} />
      </View>
      <Text style={[styles.emptyTitle, { color: textColor }]}>No folders yet</Text>
      <Text style={[styles.emptySubtitle, { color: subtitleColor }]}>
        Create folders to organize{'\n'}your saved videos
      </Text>
      <AnimatedPressable
        style={[styles.createButton, { backgroundColor: buttonBackgroundColor }]}
        onPress={onCreatePress}
        haptic
      >
        <Ionicons name="add" size={18} color={buttonForegroundColor} />
        <Text style={[styles.createButtonText, { color: buttonForegroundColor }]}>
          Create folder
        </Text>
      </AnimatedPressable>
    </Animated.View>
  );
}

// -----------------------------------------------------------------------------
// Subcomponents — folder tree node & create modal
// -----------------------------------------------------------------------------

function FolderNodeView({
  node,
  onSelect,
}: {
  node: FolderNode;
  onSelect: (folder: Folder) => void;
}) {
  const { colors } = useTheme();
  const [isExpanded, setIsExpanded] = useState(true);
  const hasChildren = node.children.length > 0;

  return (
    <View style={styles.nodeContainer}>
      <AnimatedPressable
        style={[styles.folderCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={() => {
          if (hasChildren) {
            setIsExpanded(!isExpanded);
          } else {
            onSelect(node.folder);
          }
        }}
        onLongPress={() => onSelect(node.folder)}
        scaleOnPress={0.98}
      >
        <View style={styles.folderCardContent}>
          <View style={[styles.folderIconWrapper, { backgroundColor: colors.accentSubtle }]}>
            <Ionicons name="folder-open-outline" size={22} color={colors.accent} />
          </View>
          <View style={styles.folderInfo}>
            <Text style={[styles.folderName, { color: colors.text }]}>{node.folder.name}</Text>
            <Text style={[styles.folderItemCount, { color: colors.textTertiary }]}>
              {node.folder.itemCount} video{node.folder.itemCount !== 1 ? 's' : ''}
            </Text>
          </View>
          {hasChildren ? (
            <View style={[styles.chevronWrapper, { backgroundColor: colors.surfaceHover }]}>
              <Ionicons
                name="chevron-down"
                size={16}
                color={colors.textTertiary}
                style={{ transform: [{ rotate: isExpanded ? '0deg' : '-90deg' }] }}
              />
            </View>
          ) : (
            <View style={[styles.chevronWrapper, { backgroundColor: colors.surfaceHover }]}>
              <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
            </View>
          )}
        </View>
      </AnimatedPressable>

      {isExpanded && hasChildren && (
        <View style={styles.childrenContainer}>
          {node.children.map((childNode) => (
            <AnimatedPressable
              key={childNode.folder.id}
              style={[styles.childRow, { borderBottomColor: colors.border }]}
              onPress={() => onSelect(childNode.folder)}
            >
              <View style={[styles.childIconWrapper, { backgroundColor: colors.accentSubtle }]}>
                <Ionicons name="folder-outline" size={14} color={colors.accent} />
              </View>
              <Text style={[styles.childName, { color: colors.text }]}>
                {childNode.folder.name}
              </Text>
              <Text style={[styles.childCount, { color: colors.textQuaternary }]}>
                {childNode.folder.itemCount}
              </Text>
              <Ionicons name="chevron-forward" size={14} color={colors.textQuaternary} />
            </AnimatedPressable>
          ))}
        </View>
      )}
    </View>
  );
}

function AddFolderModal({
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
  const [selectedParentId, setSelectedParentId] = useState<string | undefined>();

  const icons = ['📁', '🍽️', '✈️', '💪', '👗', '🎵', '📱', '💰', '🐾', '📚'];

  const handleCreate = () => {
    if (name.trim()) {
      onCreate(name.trim(), selectedParentId, selectedIcon);
      setName('');
      setSelectedIcon('📁');
      setSelectedParentId(undefined);
      onClose();
    }
  };

  const topLevelFolders = folders.filter((f) => !f.parentId);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>New Folder</Text>
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
            style={[
              styles.textInput,
              { borderColor: colors.border, color: colors.text, backgroundColor: colors.surface },
            ]}
            placeholder="Folder name"
            placeholderTextColor={colors.textQuaternary}
            value={name}
            onChangeText={setName}
            autoFocus
          />

          {topLevelFolders.length > 0 && (
            <>
              <Text style={[styles.inputLabel, { color: colors.textTertiary }]}>
                PARENT (OPTIONAL)
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.parentPicker}
              >
                <AnimatedPressable
                  style={[
                    styles.parentOption,
                    {
                      backgroundColor: !selectedParentId ? colors.accentSubtle : 'transparent',
                      borderColor: !selectedParentId ? colors.accent : colors.border,
                    },
                  ]}
                  onPress={() => setSelectedParentId(undefined)}
                >
                  <Text style={[styles.parentText, { color: colors.text }]}>None</Text>
                </AnimatedPressable>
                {topLevelFolders.map((folder) => (
                  <AnimatedPressable
                    key={folder.id}
                    style={[
                      styles.parentOption,
                      {
                        backgroundColor:
                          selectedParentId === folder.id ? colors.accentSubtle : 'transparent',
                        borderColor: selectedParentId === folder.id ? colors.accent : colors.border,
                      },
                    ]}
                    onPress={() => setSelectedParentId(folder.id)}
                  >
                    <Text style={[styles.parentText, { color: colors.text }]}>{folder.name}</Text>
                  </AnimatedPressable>
                ))}
              </ScrollView>
            </>
          )}

          <View style={styles.modalActions}>
            <AnimatedPressable style={styles.cancelButton} onPress={onClose}>
              <Text style={[styles.cancelButtonText, { color: colors.textSecondary }]}>Cancel</Text>
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
              <Text style={[styles.saveButtonText, { color: colors.background }]}>Create</Text>
            </AnimatedPressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
  },
  headerTitle: {
    ...Typography.displayMd,
  },
  headerCount: {
    ...Typography.caption,
    marginTop: Spacing.xs,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: Spacing.xl + TAB_BAR_OVERLAP,
  },

  // Empty state
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  emptyIconWrapper: {
    width: 72,
    height: 72,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  emptyTitle: {
    ...Typography.heading,
    marginBottom: Spacing.xs,
  },
  emptySubtitle: {
    ...Typography.body,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.sm,
  },
  createButtonText: {
    ...Typography.bodyStrong,
  },

  // Folder node
  nodeContainer: {
    marginBottom: Spacing.md,
  },
  folderCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    ...Shadows.xs,
  },
  folderCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  folderIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  folderInfo: {
    flex: 1,
  },
  folderName: {
    ...Typography.bodyStrong,
    fontSize: 16,
  },
  folderItemCount: {
    ...Typography.caption,
    marginTop: 2,
  },
  chevronWrapper: {
    width: 28,
    height: 28,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  childrenContainer: {
    marginLeft: Spacing.xl,
    marginTop: Spacing.xs,
    gap: Spacing.xs,
  },
  childRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: Hairline,
    borderRadius: BorderRadius.sm,
  },
  childIconWrapper: {
    width: 28,
    height: 28,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  childName: {
    ...Typography.bodySm,
    flex: 1,
  },
  childCount: {
    ...Typography.caption,
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
  parentPicker: {
    flexGrow: 0,
  },
  parentOption: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    marginRight: Spacing.xs,
  },
  parentText: {
    ...Typography.caption,
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
