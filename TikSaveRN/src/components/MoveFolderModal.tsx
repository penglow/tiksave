import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Colors, Spacing, BorderRadius } from '../config';
import { SaveItem, Folder, FolderNode, getDisplayTitle, getDisplayIcon } from '../types';
import { apiService } from '../services/api';

interface Props {
  visible: boolean;
  item: SaveItem | null;
  onClose: () => void;
  onMove: (folderId: string | null) => void;
}

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

export default function MoveFolderModal({ visible, item, onClose, onMove }: Props) {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [folderNodes, setFolderNodes] = useState<FolderNode[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null | undefined>();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (visible) {
      loadFolders();
    }
  }, [visible]);

  const loadFolders = async () => {
    setIsLoading(true);
    try {
      const data = await apiService.getFolders();
      setFolders(data);
      setFolderNodes(buildFolderTree(data));
    } catch (error) {
      console.error('Failed to load folders:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMove = () => {
    if (selectedFolderId !== undefined) {
      onMove(selectedFolderId);
    }
  };

  if (!item) return null;

  // Find suggested folder
  const suggestedFolder =
    item.predictedFolderId && item.predictedFolderId !== item.folderId
      ? folders.find((f) => f.id === item.predictedFolderId)
      : null;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Move to Folder</Text>
            <TouchableOpacity
              onPress={handleMove}
              disabled={
                selectedFolderId === undefined || 
                selectedFolderId === (item.folderId || null)
              }
            >
              <Text
                style={[
                  styles.moveText,
                  (selectedFolderId === undefined || 
                   selectedFolderId === (item.folderId || null)) && styles.moveTextDisabled,
                ]}
              >
                Move
              </Text>
            </TouchableOpacity>
          </View>

          {/* Item Preview */}
          <View style={styles.itemPreview}>
            <View style={styles.itemThumbnail}>
              <Ionicons name="play" size={16} color={Colors.textTertiary} />
            </View>
            <View style={styles.itemInfo}>
              <Text style={styles.itemTitle} numberOfLines={2}>
                {getDisplayTitle(item)}
              </Text>
              {item.folderName && (
                <View style={styles.currentFolder}>
                  <Text style={styles.currentFolderLabel}>Currently in: </Text>
                  <Text style={styles.currentFolderName}>{item.folderName}</Text>
                </View>
              )}
            </View>
          </View>

          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={Colors.primary} />
            </View>
          ) : (
            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
              {/* Library Option */}
              {item.folderId && (
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>Move To</Text>
                  <TouchableOpacity
                    style={[
                      styles.folderOption,
                      selectedFolderId === null && styles.folderOptionSelected,
                    ]}
                    onPress={() => setSelectedFolderId(null)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.folderIcon}>
                      <Ionicons name="library-outline" size={18} color={Colors.primary} />
                    </View>
                    <View style={styles.folderInfo}>
                      <Text style={styles.folderName}>Library</Text>
                      <Text style={styles.confidenceText}>Move back to main library</Text>
                    </View>
                    {selectedFolderId === null && (
                      <Ionicons name="checkmark-circle" size={22} color={Colors.primary} />
                    )}
                  </TouchableOpacity>
                </View>
              )}

              {/* AI Suggestion */}
              {suggestedFolder && (
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>AI Suggestion</Text>
                  <TouchableOpacity
                    style={[
                      styles.folderOption,
                      styles.suggestedOption,
                      selectedFolderId === suggestedFolder.id && styles.folderOptionSelected,
                    ]}
                    onPress={() => setSelectedFolderId(suggestedFolder.id)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.folderIcon}>
                      <Text style={styles.folderEmoji}>{getDisplayIcon(suggestedFolder) || '📁'}</Text>
                    </View>
                    <View style={styles.folderInfo}>
                      <Text style={styles.folderName}>{suggestedFolder.name}</Text>
                      {item.confidence && item.confidence > 0 && (
                        <Text style={styles.confidenceText}>
                          {Math.round(item.confidence * 100)}% confident
                        </Text>
                      )}
                    </View>
                    {selectedFolderId === suggestedFolder.id && (
                      <Ionicons name="checkmark-circle" size={22} color={Colors.primary} />
                    )}
                  </TouchableOpacity>
                </View>
              )}

              {/* All Folders */}
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>All Folders</Text>
                {folderNodes.map((node) => (
                  <FolderNodeItem
                    key={node.folder.id}
                    node={node}
                    selectedId={selectedFolderId}
                    currentFolderId={item.folderId}
                    onSelect={setSelectedFolderId}
                  />
                ))}
              </View>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

function FolderNodeItem({
  node,
  selectedId,
  currentFolderId,
  onSelect,
}: {
  node: FolderNode;
  selectedId?: string | null;
  currentFolderId?: string;
  onSelect: (id: string) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  const hasChildren = node.children.length > 0;
  const isSelected = selectedId === node.folder.id;
  const isCurrent = currentFolderId === node.folder.id;

  return (
    <View style={styles.nodeContainer}>
      <TouchableOpacity
        style={[styles.folderOption, isSelected && styles.folderOptionSelected]}
        onPress={() => !isCurrent && onSelect(node.folder.id)}
        activeOpacity={0.7}
      >
        {hasChildren && (
          <TouchableOpacity
            onPress={() => setIsExpanded(!isExpanded)}
            style={styles.expandButton}
          >
            <Ionicons
              name="chevron-down"
              size={14}
              color={Colors.textQuaternary}
              style={{ transform: [{ rotate: isExpanded ? '0deg' : '-90deg' }] }}
            />
          </TouchableOpacity>
        )}
        {!hasChildren && <View style={styles.expandPlaceholder} />}

        <View style={[styles.folderIcon, isSelected && styles.folderIconSelected]}>
          <Text style={styles.folderEmoji}>{getDisplayIcon(node.folder) || '📁'}</Text>
        </View>

        <Text
          style={[
            styles.folderName,
            isCurrent && styles.folderNameDisabled,
          ]}
        >
          {node.folder.name}
        </Text>

        {isCurrent && <Text style={styles.currentLabel}>Current</Text>}
        {isSelected && <Ionicons name="checkmark-circle" size={22} color={Colors.primary} />}
      </TouchableOpacity>

      {/* Children */}
      {isExpanded && hasChildren && (
        <View style={styles.childrenContainer}>
          {node.children.map((childNode) => (
            <TouchableOpacity
              key={childNode.folder.id}
              style={[
                styles.childOption,
                selectedId === childNode.folder.id && styles.folderOptionSelected,
              ]}
              onPress={() =>
                childNode.folder.id !== currentFolderId && onSelect(childNode.folder.id)
              }
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.childIcon,
                  selectedId === childNode.folder.id && styles.folderIconSelected,
                ]}
              >
                <Text style={styles.childEmoji}>{getDisplayIcon(childNode.folder) || '📁'}</Text>
              </View>

              <Text
                style={[
                  styles.childName,
                  childNode.folder.id === currentFolderId && styles.folderNameDisabled,
                ]}
              >
                {childNode.folder.name}
              </Text>

              {childNode.folder.id === currentFolderId && (
                <Text style={styles.currentLabel}>Current</Text>
              )}
              {selectedId === childNode.folder.id && (
                <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: Colors.backgroundSecondary,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  cancelText: {
    fontSize: 16,
    color: Colors.text,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.text,
  },
  moveText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.primary,
  },
  moveTextDisabled: {
    opacity: 0.5,
  },
  itemPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.lg,
    backgroundColor: Colors.overlayLight,
  },
  itemThumbnail: {
    width: 50,
    height: 66,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemInfo: {
    flex: 1,
    gap: 4,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
  },
  currentFolder: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  currentFolderLabel: {
    fontSize: 12,
    color: Colors.textTertiary,
  },
  currentFolderName: {
    fontSize: 12,
    color: Colors.primary,
  },
  loadingContainer: {
    padding: Spacing.xxxl,
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  section: {
    gap: Spacing.sm,
  },
  sectionLabel: {
    fontSize: 12,
    color: Colors.textTertiary,
    marginLeft: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  nodeContainer: {
    gap: Spacing.xs,
  },
  folderOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: BorderRadius.md,
  },
  folderOptionSelected: {
    backgroundColor: `${Colors.primary}1A`,
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  suggestedOption: {
    backgroundColor: `${Colors.primary}0D`,
  },
  expandButton: {
    width: 20,
    alignItems: 'center',
  },
  expandPlaceholder: {
    width: 20,
  },
  folderIcon: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
  folderIconSelected: {
    backgroundColor: `${Colors.primary}4D`,
  },
  folderEmoji: {
    fontSize: 18,
  },
  folderInfo: {
    flex: 1,
    gap: 2,
  },
  folderName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: Colors.text,
  },
  folderNameDisabled: {
    color: Colors.textTertiary,
  },
  confidenceText: {
    fontSize: 12,
    color: Colors.primary,
  },
  currentLabel: {
    fontSize: 12,
    color: Colors.textQuaternary,
  },
  childrenContainer: {
    marginLeft: 32,
    gap: 4,
  },
  childOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: BorderRadius.sm,
  },
  childIcon: {
    width: 30,
    height: 30,
    borderRadius: 6,
    backgroundColor: Colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
  childEmoji: {
    fontSize: 14,
  },
  childName: {
    flex: 1,
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
  },
});

