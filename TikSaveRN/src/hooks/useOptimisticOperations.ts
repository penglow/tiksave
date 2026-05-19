/**
 * Optimistic item operations: move-to-folder and delete with undo window.
 * Updates list UI immediately and rolls back or confirms via the API.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { apiService } from '../services/api';
import { SaveItem } from '../types';
import { optimisticUpdate } from '../utils/optimistic';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PendingDelete {
  item: SaveItem;
  timeoutId: ReturnType<typeof setTimeout>;
}

interface UseOptimisticOperationsOptions {
  /** Callback when item is updated */
  onItemUpdate?: (itemId: string, updates: Partial<SaveItem>) => void;
  /** Callback when item is removed from list */
  onItemRemove?: (itemId: string) => void;
  /** Callback when item is added back to list */
  onItemRestore?: (item: SaveItem) => void;
  /** Delay before confirming delete (undo window) */
  undoDelay?: number;
}

interface UndoState {
  itemId: string;
  message: string;
  timeRemaining: number;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Optimistic update operations for save items.
 * Supports move-to-folder and delete with undo.
 *
 * @param options - List mutation callbacks and undo delay.
 */
export function useOptimisticOperations(options: UseOptimisticOperationsOptions = {}) {
  const { onItemUpdate, onItemRemove, onItemRestore, undoDelay = 5000 } = options;

  const [pendingDeletes, setPendingDeletes] = useState<Map<string, PendingDelete>>(new Map());
  const [undoState, setUndoState] = useState<UndoState | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (undoTimerRef.current) {
        clearInterval(undoTimerRef.current);
      }
      // Cancel all pending deletes
      pendingDeletes.forEach((pending) => {
        clearTimeout(pending.timeoutId);
      });
    };
  }, []);

  // Update undo timer countdown
  useEffect(() => {
    if (undoState) {
      undoTimerRef.current = setInterval(() => {
        setUndoState((prev) => {
          if (!prev) return null;
          const newTime = prev.timeRemaining - 100;
          if (newTime <= 0) {
            return null;
          }
          return { ...prev, timeRemaining: newTime };
        });
      }, 100);

      return () => {
        if (undoTimerRef.current) {
          clearInterval(undoTimerRef.current);
        }
      };
    }
  }, [undoState?.itemId]);

  /** Move item to folder with optimistic update. */
  const moveToFolder = useCallback(
    async (item: SaveItem, folderId: string | null, folderName?: string): Promise<boolean> => {
      const originalFolderId = item.folderId;
      const originalFolderName = item.folderName;

      const result = await optimisticUpdate({
        mutate: () => apiService.moveItemToFolder(item.id, folderId),
        onOptimistic: () => {
          // Immediately update UI
          onItemUpdate?.(item.id, { folderId: folderId ?? undefined, folderName });
          return { folderId: originalFolderId, folderName: originalFolderName };
        },
        onSuccess: (updatedItem) => {
          // Update with real data from server
          onItemUpdate?.(item.id, {
            folderId: updatedItem.folderId,
            folderName: updatedItem.folderName,
          });
        },
        onError: (error, rollbackState) => {
          // Rollback on failure
          onItemUpdate?.(item.id, {
            folderId: rollbackState.folderId,
            folderName: rollbackState.folderName,
          });
          console.error('Failed to move item:', error);
        },
      });

      return result !== null;
    },
    [onItemUpdate],
  );

  /** Delete item with undo capability. */
  const deleteWithUndo = useCallback(
    (item: SaveItem): void => {
      // Immediately remove from UI
      onItemRemove?.(item.id);

      // Show undo state
      setUndoState({
        itemId: item.id,
        message: `Deleted "${item.title || 'video'}"`,
        timeRemaining: undoDelay,
      });

      // Set timeout for actual deletion
      const timeoutId = setTimeout(async () => {
        try {
          await apiService.deleteItem(item.id);
        } catch (error) {
          console.error('Failed to delete item:', error);
          // Restore item on failure
          onItemRestore?.(item);
        } finally {
          setPendingDeletes((prev) => {
            const next = new Map(prev);
            next.delete(item.id);
            return next;
          });
          setUndoState((prev) => (prev?.itemId === item.id ? null : prev));
        }
      }, undoDelay);

      // Track pending delete
      setPendingDeletes((prev) => {
        const next = new Map(prev);
        next.set(item.id, { item, timeoutId });
        return next;
      });
    },
    [onItemRemove, onItemRestore, undoDelay],
  );

  /** Undo a pending delete before the confirmation timeout fires. */
  const undoDelete = useCallback(
    (itemId: string): boolean => {
      const pending = pendingDeletes.get(itemId);
      if (!pending) return false;

      // Cancel the delete timeout
      clearTimeout(pending.timeoutId);

      // Restore the item
      onItemRestore?.(pending.item);

      // Clear from pending
      setPendingDeletes((prev) => {
        const next = new Map(prev);
        next.delete(itemId);
        return next;
      });

      // Clear undo state
      setUndoState((prev) => (prev?.itemId === itemId ? null : prev));

      return true;
    },
    [pendingDeletes, onItemRestore],
  );

  /** Dismiss undo notification without undoing. */
  const dismissUndo = useCallback(() => {
    setUndoState(null);
  }, []);

  /** Immediate delete (no undo). */
  const deleteImmediate = useCallback(
    async (itemId: string): Promise<boolean> => {
      const result = await optimisticUpdate({
        mutate: () => apiService.deleteItem(itemId),
        onOptimistic: () => {
          onItemRemove?.(itemId);
          return itemId;
        },
        onError: (error) => {
          console.error('Failed to delete item:', error);
          // Note: Can't restore without item data
        },
      });

      return result !== null;
    },
    [onItemRemove],
  );

  return {
    // Operations
    moveToFolder,
    deleteWithUndo,
    deleteImmediate,
    undoDelete,
    dismissUndo,

    // State
    undoState,
    hasPendingDeletes: pendingDeletes.size > 0,
    isPendingDelete: (itemId: string) => pendingDeletes.has(itemId),
  };
}

export default useOptimisticOperations;
