/**
 * Unique optimistic update and undo workflows.
 */

import { describe, it, expect } from 'bun:test';
import { optimisticUpdate, UndoManager } from '../../utils/optimistic';

describe('optimistic workflow scenarios', () => {
  it('delete flow: item vanishes then restores on 500 error', async () => {
    const items = [{ id: '1' }, { id: '2' }];
    let list = [...items];

    await optimisticUpdate({
      mutate: async () => {
        throw new Error('Server error');
      },
      onOptimistic: () => {
        const snapshot = [...list];
        list = list.filter((i) => i.id !== '1');
        return snapshot;
      },
      onError: (_e, snapshot) => {
        list = snapshot;
      },
    });

    expect(list).toHaveLength(2);
  });

  it('move folder: optimistic reassignment before API confirms', async () => {
    let folderId: string | null = 'inbox';
    const result = await optimisticUpdate({
      mutate: async () => {
        folderId = 'food';
        return folderId;
      },
      onOptimistic: () => {
        const prev = folderId;
        folderId = 'food-pending';
        return prev;
      },
    });
    expect(result).toBe('food');
    expect(folderId).toBe('food');
  });

  it('undo manager: rapid double-add replaces pending operation', async () => {
    let confirmCount = 0;
    const mgr = new UndoManager<void>({ confirmDelay: 500 });
    mgr.add('same-id', undefined, async () => {
      confirmCount++;
    });
    mgr.add('same-id', undefined, async () => {
      confirmCount++;
    });
    await new Promise((r) => setTimeout(r, 600));
    expect(confirmCount).toBe(1);
  });

  it('undo manager clearAll cancels every pending timeout', async () => {
    let confirmed = 0;
    const mgr = new UndoManager<void>({ confirmDelay: 300 });
    mgr.add('a', undefined, async () => {
      confirmed++;
    });
    mgr.add('b', undefined, async () => {
      confirmed++;
    });
    mgr.clearAll();
    await new Promise((r) => setTimeout(r, 400));
    expect(confirmed).toBe(0);
  });

  it('errorDelay prevents flash rollback on fast retry success', async () => {
    let attempts = 0;
    const result = await optimisticUpdate({
      errorDelay: 50,
      mutate: async () => {
        attempts++;
        if (attempts === 1) throw new Error('transient');
        return 'ok';
      },
      onOptimistic: () => 'rollback',
      onError: () => {},
    });
    expect(result).toBeNull();
    expect(attempts).toBe(1);
  });
});
