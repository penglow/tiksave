/**
 * Optimistic update utilities for immediate UI feedback with rollback on failure.
 * Includes a generic `optimisticUpdate` helper and an `UndoManager` for delayed confirms.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OptimisticUpdateOptions<T, R = T> {
  /** The async operation to perform (usually an API call) */
  mutate: () => Promise<R>;
  /** Function to apply optimistic state update */
  onOptimistic: () => T;
  /** Called with the real data when mutation succeeds */
  onSuccess?: (result: R) => void;
  /** Called with the original state to rollback on failure */
  onError?: (error: Error, rollbackState: T) => void;
  /** Delay before showing error (gives time for quick retries) */
  errorDelay?: number;
}

export interface UndoableOperation<T> {
  /** The data that was removed/changed */
  data: T;
  /** Timestamp when the operation was performed */
  timestamp: number;
  /** Function to undo the operation */
  undo: () => void;
  /** Timeout ID for auto-confirm */
  timeoutId: ReturnType<typeof setTimeout>;
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

/**
 * Execute an operation with optimistic updates.
 *
 * @example
 * ```typescript
 * const originalItem = items.find(i => i.id === itemId);
 *
 * await optimisticUpdate({
 *   mutate: () => apiService.deleteItem(itemId),
 *   onOptimistic: () => {
 *     removeItem(itemId);
 *     return originalItem;
 *   },
 *   onError: (error, originalItem) => {
 *     addItem(originalItem);
 *     showToast('Failed to delete item');
 *   },
 * });
 * ```
 */
export async function optimisticUpdate<T, R = T>({
  mutate,
  onOptimistic,
  onSuccess,
  onError,
  errorDelay = 0,
}: OptimisticUpdateOptions<T, R>): Promise<R | null> {
  // Apply optimistic update and capture rollback state
  const rollbackState = onOptimistic();

  try {
    // Execute the actual mutation
    const result = await mutate();

    // Call success handler with real data
    onSuccess?.(result);

    return result;
  } catch (error) {
    // Wait a bit before showing error (prevents flash on quick retries)
    if (errorDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, errorDelay));
    }

    // Rollback on error
    const err = error instanceof Error ? error : new Error(String(error));
    onError?.(err, rollbackState);

    return null;
  }
}

/**
 * Create an optimistic update handler with shared default options.
 *
 * @param defaultOptions - Partial options merged into each invocation.
 */
export function createOptimisticHandler<T, R = T>(
  defaultOptions: Partial<OptimisticUpdateOptions<T, R>>
) {
  return (options: OptimisticUpdateOptions<T, R>) =>
    optimisticUpdate({ ...defaultOptions, ...options });
}

// ---------------------------------------------------------------------------
// UndoManager
// ---------------------------------------------------------------------------

/** Manages delayed-confirm operations with undo support. */
export class UndoManager<T> {
  private operations: Map<string, UndoableOperation<T>> = new Map();
  private confirmDelay: number;
  private onUndo?: (operationId: string, data: T) => void;

  constructor(options: {
    confirmDelay?: number;
    onUndo?: (operationId: string, data: T) => void;
  } = {}) {
    this.confirmDelay = options.confirmDelay ?? 5000;
    this.onUndo = options.onUndo;
  }

  /** Add an operation that can be undone before auto-confirm. */
  add(
    operationId: string,
    data: T,
    onConfirm: () => Promise<void>
  ): () => void {
    // Clear any existing operation with same ID
    this.cancel(operationId);

    const timeoutId = setTimeout(async () => {
      this.operations.delete(operationId);
      await onConfirm();
    }, this.confirmDelay);

    const operation: UndoableOperation<T> = {
      data,
      timestamp: Date.now(),
      undo: () => {
        this.cancel(operationId);
        this.onUndo?.(operationId, data);
      },
      timeoutId,
    };

    this.operations.set(operationId, operation);

    // Return undo function
    return operation.undo;
  }

  /** Cancel a pending operation (called when undoing). */
  cancel(operationId: string): boolean {
    const operation = this.operations.get(operationId);
    if (operation) {
      clearTimeout(operation.timeoutId);
      this.operations.delete(operationId);
      return true;
    }
    return false;
  }

  /** Get remaining time for an operation in milliseconds. */
  getTimeRemaining(operationId: string): number | null {
    const operation = this.operations.get(operationId);
    if (!operation) return null;

    const elapsed = Date.now() - operation.timestamp;
    return Math.max(0, this.confirmDelay - elapsed);
  }

  /** Check if an operation is pending confirmation. */
  isPending(operationId: string): boolean {
    return this.operations.has(operationId);
  }

  /** Clear all pending operations and cancel their timeouts. */
  clearAll(): void {
    for (const operation of this.operations.values()) {
      clearTimeout(operation.timeoutId);
    }
    this.operations.clear();
  }
}

export default optimisticUpdate;
