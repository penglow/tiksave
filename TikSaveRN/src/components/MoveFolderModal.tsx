/**
 * Bottom-sheet modal to move a saved item into a folder (library, AI suggestion, or tree picker).
 * Loads folders from the API and renders a collapsible two-level folder hierarchy.
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Spacing, BorderRadius, Typography, Hairline } from '../config';
import { SaveItem, Folder, FolderNode, getDisplayTitle, getDisplayIcon } from '../types';
import { apiService } from '../services/api';
import { useTheme } from '../hooks/useTheme';
import { AnimatedPressable } from './AnimatedPressable';

// --- Types / props ---
interface Props {
  visible: boolean;
  item: SaveItem | null;
  onClose: () => void;
  onMove: (folderId: string | null) => void;
}

interface FolderNodeItemProps {
  node: FolderNode;
  selectedId?: string | null;
  currentFolderId?: string;
  onSelect: (id: string) => void;
}

// --- Helpers ---
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

// --- Main component ---
export default function MoveFolderModal({ visible, item, onClose, onMove }: Props) {
  const { colors } = useTheme();
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

  const suggestedFolder =
    item.predictedFolderId && item.predictedFolderId !== item.folderId
      ? folders.find((f) => f.id === item.predictedFolderId)
      : null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.container, { backgroundColor: colors.background }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <AnimatedPressable onPress={onClose}>
              <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancel</Text>
            </AnimatedPressable>
            <Text style={[styles.title, { color: colors.text }]}>Move to Folder</Text>
            <AnimatedPressable
              onPress={handleMove}
              disabled={
                selectedFolderId === undefined || selectedFolderId === (item.folderId || null)
              }
            >
              <Text
                style={[
                  styles.moveText,
                  { color: colors.text },
                  (selectedFolderId === undefined ||
                    selectedFolderId === (item.folderId || null)) &&
                    styles.moveTextDisabled,
                ]}
              >
                Move
              </Text>
            </AnimatedPressable>
          </View>

          {/* Item Preview */}
          <View style={[styles.itemPreview, { borderBottomColor: colors.border }]}>
            <View style={[styles.itemThumbnail, { backgroundColor: colors.accentSubtle }]}>
              <Ionicons name="play" size={14} color={colors.textTertiary} />
            </View>
            <View style={styles.itemInfo}>
              <Text style={[styles.itemTitle, { color: colors.text }]} numberOfLines={2}>
                {getDisplayTitle(item)}
              </Text>
              {item.folderName && (
                <Text style={[styles.currentFolderText, { color: colors.textTertiary }]}>
                  Currently in: {item.folderName}
                </Text>
              )}
            </View>
          </View>

          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={colors.text} />
            </View>
          ) : (
            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              {/* Library Option */}
              {item.folderId && (
                <View style={styles.section}>
                  <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>MOVE TO</Text>
                  <AnimatedPressable
                    style={[
                      styles.folderRow,
                      { borderBottomColor: colors.border },
                      selectedFolderId === null && { backgroundColor: colors.accentSubtle },
                    ]}
                    onPress={() => setSelectedFolderId(null)}
                  >
                    <Ionicons name="library-outline" size={18} color={colors.text} />
                    <View style={styles.folderInfo}>
                      <Text style={[styles.folderName, { color: colors.text }]}>Library</Text>
                      <Text style={[styles.folderSubtext, { color: colors.textTertiary }]}>
                        Move back to main library
                      </Text>
                    </View>
                    {selectedFolderId === null && (
                      <Ionicons name="checkmark" size={18} color={colors.text} />
                    )}
                  </AnimatedPressable>
                </View>
              )}

              {/* AI Suggestion */}
              {suggestedFolder && (
                <View style={styles.section}>
                  <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>
                    AI SUGGESTION
                  </Text>
                  <AnimatedPressable
                    style={[
                      styles.folderRow,
                      { borderBottomColor: colors.border },
                      selectedFolderId === suggestedFolder.id && {
                        backgroundColor: colors.accentSubtle,
                      },
                    ]}
                    onPress={() => setSelectedFolderId(suggestedFolder.id)}
                  >
                    <Text style={styles.folderEmoji}>
                      {getDisplayIcon(suggestedFolder) || '📁'}
                    </Text>
                    <View style={styles.folderInfo}>
                      <Text style={[styles.folderName, { color: colors.text }]}>
                        {suggestedFolder.name}
                      </Text>
                      {item.confidence && item.confidence > 0 && (
                        <Text style={[styles.folderSubtext, { color: colors.textTertiary }]}>
                          {Math.round(item.confidence * 100)}% confident
                        </Text>
                      )}
                    </View>
                    {selectedFolderId === suggestedFolder.id && (
                      <Ionicons name="checkmark" size={18} color={colors.text} />
                    )}
                  </AnimatedPressable>
                </View>
              )}

              {/* All Folders */}
              <View style={styles.section}>
                <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>
                  ALL FOLDERS
                </Text>
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

// --- Helpers (subcomponents) ---
function FolderNodeItem({ node, selectedId, currentFolderId, onSelect }: FolderNodeItemProps) {
  const { colors } = useTheme();
  const [isExpanded, setIsExpanded] = useState(true);
  const hasChildren = node.children.length > 0;
  const isSelected = selectedId === node.folder.id;
  const isCurrent = currentFolderId === node.folder.id;

  return (
    <View style={styles.nodeContainer}>
      <AnimatedPressable
        style={[
          styles.folderRow,
          { borderBottomColor: colors.border },
          isSelected && { backgroundColor: colors.accentSubtle },
        ]}
        onPress={() => !isCurrent && onSelect(node.folder.id)}
        disabled={isCurrent}
      >
        {hasChildren && (
          <AnimatedPressable onPress={() => setIsExpanded(!isExpanded)} style={styles.expandButton}>
            <Ionicons
              name="chevron-down"
              size={14}
              color={colors.textQuaternary}
              style={{ transform: [{ rotate: isExpanded ? '0deg' : '-90deg' }] }}
            />
          </AnimatedPressable>
        )}
        {!hasChildren && <View style={styles.expandPlaceholder} />}

        <Text style={styles.folderEmoji}>{getDisplayIcon(node.folder) || '📁'}</Text>

        <Text
          style={[styles.folderName, { color: isCurrent ? colors.textQuaternary : colors.text }]}
        >
          {node.folder.name}
        </Text>

        {isCurrent && (
          <Text style={[styles.currentLabel, { color: colors.textQuaternary }]}>Current</Text>
        )}
        {isSelected && <Ionicons name="checkmark" size={18} color={colors.text} />}
      </AnimatedPressable>

      {/* Children */}
      {isExpanded && hasChildren && (
        <View style={styles.childrenContainer}>
          {node.children.map((childNode) => {
            const childIsSelected = selectedId === childNode.folder.id;
            const childIsCurrent = currentFolderId === childNode.folder.id;

            return (
              <AnimatedPressable
                key={childNode.folder.id}
                style={[
                  styles.childRow,
                  { borderBottomColor: colors.border },
                  childIsSelected && { backgroundColor: colors.accentSubtle },
                ]}
                onPress={() => !childIsCurrent && onSelect(childNode.folder.id)}
                disabled={childIsCurrent}
              >
                <Text style={styles.childEmoji}>{getDisplayIcon(childNode.folder) || '📁'}</Text>
                <Text
                  style={[
                    styles.childName,
                    { color: childIsCurrent ? colors.textQuaternary : colors.text },
                  ]}
                >
                  {childNode.folder.name}
                </Text>
                {childIsCurrent && (
                  <Text style={[styles.currentLabel, { color: colors.textQuaternary }]}>
                    Current
                  </Text>
                )}
                {childIsSelected && <Ionicons name="checkmark" size={16} color={colors.text} />}
              </AnimatedPressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

// --- Styles ---
const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  container: {
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: Hairline,
  },
  cancelText: {
    ...Typography.body,
  },
  title: {
    ...Typography.headingSm,
  },
  moveText: {
    ...Typography.bodyStrong,
  },
  moveTextDisabled: {
    opacity: 0.3,
  },
  itemPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderBottomWidth: Hairline,
  },
  itemThumbnail: {
    width: 40,
    height: 53,
    borderRadius: BorderRadius.xs,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemInfo: {
    flex: 1,
    gap: 2,
  },
  itemTitle: {
    ...Typography.captionStrong,
  },
  currentFolderText: {
    fontSize: 12,
  },
  loadingContainer: {
    padding: Spacing.xxl,
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: Spacing.xl,
  },
  section: {
    marginBottom: Spacing.md,
  },
  sectionLabel: {
    ...Typography.label,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  nodeContainer: {},
  folderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: Hairline,
  },
  expandButton: {
    width: 20,
    alignItems: 'center',
  },
  expandPlaceholder: {
    width: 20,
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
    ...Typography.body,
  },
  folderSubtext: {
    fontSize: 12,
  },
  currentLabel: {
    fontSize: 11,
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
    fontSize: 14,
  },
  childName: {
    flex: 1,
    ...Typography.bodySm,
  },
});
