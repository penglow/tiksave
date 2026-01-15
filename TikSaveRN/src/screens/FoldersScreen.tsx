import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

import { Colors, Spacing, BorderRadius } from '../config';
import { Folder, FolderNode, getDisplayIcon } from '../types';
import { apiService } from '../services/api';
import { FoldersStackScreenProps } from '../navigation/types';

type Props = FoldersStackScreenProps<'FoldersList'>;

// Build tree structure from flat folders
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
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (folderNodes.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIconContainer}>
          <Ionicons name="folder-open" size={50} color={Colors.secondary} />
        </View>
        <Text style={styles.emptyTitle}>No folders yet</Text>
        <Text style={styles.emptySubtitle}>
          Create folders to organize{'\n'}your saved TikToks
        </Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowAddModal(true)}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={[Colors.primary, Colors.secondary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.addButtonGradient}
          >
            <Ionicons name="add" size={20} color={Colors.text} />
            <Text style={styles.addButtonText}>Add Folder</Text>
          </LinearGradient>
        </TouchableOpacity>

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
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.primary}
          />
        }
      >
        {folderNodes.map((node) => (
          <FolderNodeView
            key={node.folder.id}
            node={node}
            onSelect={(folder) => navigation.navigate('FolderDetail', { folder })}
          />
        ))}
      </ScrollView>

      {/* Add Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setShowAddModal(true)}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={[Colors.primary, Colors.secondary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.fabGradient}
        >
          <Ionicons name="add" size={28} color={Colors.text} />
        </LinearGradient>
      </TouchableOpacity>

      <AddFolderModal
        visible={showAddModal}
        folders={folders}
        onClose={() => setShowAddModal(false)}
        onCreate={handleCreateFolder}
      />
    </View>
  );
}

// Folder Node View
function FolderNodeView({
  node,
  onSelect,
}: {
  node: FolderNode;
  onSelect: (folder: Folder) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  const hasChildren = node.children.length > 0;

  return (
    <View style={styles.nodeContainer}>
      <TouchableOpacity
        style={styles.folderRow}
        onPress={() => {
          if (hasChildren) {
            setIsExpanded(!isExpanded);
          } else {
            onSelect(node.folder);
          }
        }}
        onLongPress={() => onSelect(node.folder)}
        activeOpacity={0.7}
      >
        <View style={styles.folderIconContainer}>
          <LinearGradient
            colors={[`${Colors.primary}4D`, `${Colors.secondary}4D`]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.folderIcon}
          >
            <Text style={styles.folderEmoji}>{getDisplayIcon(node.folder) || '📁'}</Text>
          </LinearGradient>
        </View>

        <View style={styles.folderInfo}>
          <Text style={styles.folderName}>{node.folder.name}</Text>
          <Text style={styles.folderItemCount}>{node.folder.itemCount} items</Text>
        </View>

        {hasChildren ? (
          <Ionicons
            name="chevron-down"
            size={16}
            color={Colors.textQuaternary}
            style={{ transform: [{ rotate: isExpanded ? '0deg' : '-90deg' }] }}
          />
        ) : (
          <Ionicons name="chevron-forward" size={16} color={Colors.textQuaternary} />
        )}
      </TouchableOpacity>

      {/* Children */}
      {isExpanded && hasChildren && (
        <View style={styles.childrenContainer}>
          {node.children.map((childNode) => (
            <TouchableOpacity
              key={childNode.folder.id}
              style={styles.childRow}
              onPress={() => onSelect(childNode.folder)}
              activeOpacity={0.7}
            >
              <View style={styles.childIcon}>
                <Text style={styles.childEmoji}>{getDisplayIcon(childNode.folder) || '📁'}</Text>
              </View>
              <Text style={styles.childName}>{childNode.folder.name}</Text>
              <Text style={styles.childCount}>{childNode.folder.itemCount}</Text>
              <Ionicons name="chevron-forward" size={12} color={Colors.textQuaternary} />
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

// Add Folder Modal
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
  const [name, setName] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('📁');
  const [selectedParentId, setSelectedParentId] = useState<string | undefined>();

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
      onClose();
    }
  };

  const topLevelFolders = folders.filter((f) => !f.parentId);

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>New Folder</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={Colors.text} />
            </TouchableOpacity>
          </View>

          {/* Icon Selector */}
          <Text style={styles.label}>Icon</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.iconScroll}>
            {availableIcons.map((icon) => (
              <TouchableOpacity
                key={icon}
                style={[styles.iconOption, selectedIcon === icon && styles.iconOptionSelected]}
                onPress={() => setSelectedIcon(icon)}
              >
                <Text style={styles.iconOptionText}>{icon}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Name Input */}
          <Text style={styles.label}>Name</Text>
          <TextInput
            style={styles.input}
            placeholder="Folder name"
            placeholderTextColor={Colors.textQuaternary}
            value={name}
            onChangeText={setName}
          />

          {/* Parent Folder */}
          <Text style={styles.label}>Parent Folder (optional)</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.parentScroll}>
            <TouchableOpacity
              style={[styles.parentOption, !selectedParentId && styles.parentOptionSelected]}
              onPress={() => setSelectedParentId(undefined)}
            >
              <Text style={styles.parentOptionText}>None (Top Level)</Text>
            </TouchableOpacity>
            {topLevelFolders.map((folder) => (
              <TouchableOpacity
                key={folder.id}
                style={[
                  styles.parentOption,
                  selectedParentId === folder.id && styles.parentOptionSelected,
                ]}
                onPress={() => setSelectedParentId(folder.id)}
              >
                <Text style={styles.parentOptionText}>{folder.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Actions */}
          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.createButton, !name.trim() && styles.createButtonDisabled]}
              onPress={handleCreate}
              disabled={!name.trim()}
            >
              <Text style={styles.createButtonText}>Create</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  loadingText: {
    marginTop: Spacing.lg,
    color: Colors.textTertiary,
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.xxl,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(168, 85, 247, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.xxl,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  emptySubtitle: {
    fontSize: 15,
    color: Colors.textTertiary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.xxl,
  },
  addButton: {
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  addButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xxl,
  },
  addButtonText: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  nodeContainer: {
    gap: Spacing.sm,
  },
  folderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
  },
  folderIconContainer: {},
  folderIcon: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  folderEmoji: {
    fontSize: 22,
  },
  folderInfo: {
    flex: 1,
    gap: 2,
  },
  folderName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  folderItemCount: {
    fontSize: 13,
    color: Colors.textTertiary,
  },
  childrenContainer: {
    marginLeft: Spacing.xxl,
    gap: Spacing.xs,
  },
  childRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  childIcon: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
  childEmoji: {
    fontSize: 16,
  },
  childName: {
    flex: 1,
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  childCount: {
    fontSize: 12,
    color: Colors.textQuaternary,
  },
  fab: {
    position: 'absolute',
    right: Spacing.xl,
    bottom: Spacing.xl,
    borderRadius: 28,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 5,
      },
      web: {
        boxShadow: `0 4px 8px rgba(6, 182, 212, 0.3)`,
      },
    }),
  },
  fabGradient: {
    width: 56,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Modal styles
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
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  modalTitle: {
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
  iconOptionText: {
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
  parentOptionText: {
    fontSize: 14,
    color: Colors.text,
  },
  modalActions: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.xxl,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  cancelButtonText: {
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
  createButtonText: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
});

