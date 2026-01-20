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

import { Spacing, BorderRadius, Typography, Hairline } from '../config';
import { Folder, FolderNode, getDisplayIcon } from '../types';
import { apiService } from '../services/api';
import { FoldersStackScreenProps } from '../navigation/types';
import { useTheme } from '../hooks/useTheme';
import { AnimatedPressable, AnimatedListItem } from '../components';

type Props = FoldersStackScreenProps<'FoldersList'>;

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

export default function FoldersScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [folders, setFolders] = useState<Folder[]>([]);
  const [folderNodes, setFolderNodes] = useState<FolderNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

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
    }, [loadFolders])
  );

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadFolders();
  };

  const handleCreateFolder = async (name: string, parentId?: string, iconName?: string) => {
    try {
      await apiService.createFolder(name, parentId, iconName);
      loadFolders();
    } catch (error) {
      console.error('Failed to create folder:', error);
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="small" color={colors.text} />
      </View>
    );
  }

  if (folderNodes.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Folders</Text>
        </View>

        <Animated.View
          entering={FadeIn.duration(300)}
          style={styles.emptyContainer}
        >
          <View style={[styles.emptyIconWrapper, { backgroundColor: colors.accentSubtle }]}>
            <Ionicons name="folder-open-outline" size={32} color={colors.textTertiary} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            No folders yet
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.textTertiary }]}>
            Create folders to organize{'\n'}your saved videos
          </Text>
          <AnimatedPressable
            style={[styles.createButton, { borderColor: colors.border }]}
            onPress={() => setShowAddModal(true)}
            haptic
          >
            <Ionicons name="add" size={18} color={colors.text} />
            <Text style={[styles.createButtonText, { color: colors.text }]}>
              Create folder
            </Text>
          </AnimatedPressable>
        </Animated.View>

        <AddFolderModal
          visible={showAddModal}
          folders={folders}
          onClose={() => setShowAddModal(false)}
          onCreate={handleCreateFolder}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Folders</Text>
        <AnimatedPressable
          style={[styles.addButton, { backgroundColor: colors.text }]}
          onPress={() => setShowAddModal(true)}
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
            <FolderNodeView
              node={node}
              onSelect={(folder) => navigation.navigate('FolderDetail', { folder })}
            />
          </AnimatedListItem>
        ))}
      </ScrollView>

      <AddFolderModal
        visible={showAddModal}
        folders={folders}
        onClose={() => setShowAddModal(false)}
        onCreate={handleCreateFolder}
      />
    </View>
  );
}

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
        style={[styles.folderRow, { borderBottomColor: colors.border }]}
        onPress={() => {
          if (hasChildren) {
            setIsExpanded(!isExpanded);
          } else {
            onSelect(node.folder);
          }
        }}
        onLongPress={() => onSelect(node.folder)}
      >
        <Text style={styles.folderEmoji}>{getDisplayIcon(node.folder) || '📁'}</Text>

        <View style={styles.folderInfo}>
          <Text style={[styles.folderName, { color: colors.text }]}>{node.folder.name}</Text>
          <Text style={[styles.folderItemCount, { color: colors.textTertiary }]}>
            {node.folder.itemCount} videos
          </Text>
        </View>

        {hasChildren ? (
          <Ionicons
            name="chevron-down"
            size={16}
            color={colors.textQuaternary}
            style={{ transform: [{ rotate: isExpanded ? '0deg' : '-90deg' }] }}
          />
        ) : (
          <Ionicons name="chevron-forward" size={16} color={colors.textQuaternary} />
        )}
      </AnimatedPressable>

      {isExpanded && hasChildren && (
        <View style={styles.childrenContainer}>
          {node.children.map((childNode) => (
            <AnimatedPressable
              key={childNode.folder.id}
              style={[styles.childRow, { borderBottomColor: colors.border }]}
              onPress={() => onSelect(childNode.folder)}
            >
              <Text style={styles.childEmoji}>{getDisplayIcon(childNode.folder) || '📁'}</Text>
              <Text style={[styles.childName, { color: colors.text }]}>{childNode.folder.name}</Text>
              <Text style={[styles.childCount, { color: colors.textQuaternary }]}>
                {childNode.folder.itemCount}
              </Text>
              <Ionicons name="chevron-forward" size={12} color={colors.textQuaternary} />
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
                    borderColor: selectedIcon === icon ? colors.text : colors.border,
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
            style={[styles.textInput, { borderColor: colors.border, color: colors.text }]}
            placeholder="Folder name"
            placeholderTextColor={colors.textQuaternary}
            value={name}
            onChangeText={setName}
            autoFocus
          />

          {topLevelFolders.length > 0 && (
            <>
              <Text style={[styles.inputLabel, { color: colors.textTertiary }]}>PARENT (OPTIONAL)</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.parentPicker}>
                <AnimatedPressable
                  style={[
                    styles.parentOption,
                    {
                      backgroundColor: !selectedParentId ? colors.accentSubtle : 'transparent',
                      borderColor: !selectedParentId ? colors.text : colors.border,
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
                        backgroundColor: selectedParentId === folder.id ? colors.accentSubtle : 'transparent',
                        borderColor: selectedParentId === folder.id ? colors.text : colors.border,
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
  },
  headerTitle: {
    ...Typography.displayMd,
  },
  addButton: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: Spacing.xl,
  },

  // Empty state
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  emptyIconWrapper: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.md,
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
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
  },
  createButtonText: {
    ...Typography.bodyStrong,
  },

  // Folder node
  nodeContainer: {},
  folderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: Hairline,
  },
  folderEmoji: {
    fontSize: 20,
  },
  folderInfo: {
    flex: 1,
  },
  folderName: {
    ...Typography.bodyStrong,
  },
  folderItemCount: {
    ...Typography.caption,
  },
  childrenContainer: {
    marginLeft: Spacing.xl,
  },
  childRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: Hairline,
  },
  childEmoji: {
    fontSize: 16,
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
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
    padding: Spacing.md,
    paddingBottom: Spacing.xl,
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
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    marginRight: Spacing.xs,
  },
  iconText: {
    fontSize: 20,
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
