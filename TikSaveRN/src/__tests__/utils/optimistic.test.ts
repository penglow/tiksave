/** Tests for optimistic updates and UndoManager. */

import { describe, it, expect } from 'bun:test';
import { optimisticUpdate, createOptimisticHandler, UndoManager } from '../../utils/optimistic';

describe('optimisticUpdate', () => {
  it('applies optimistic then succeeds', async () => {
    let state = 0;
    const result = await optimisticUpdate({
      mutate: async () => 42,
      onOptimistic: () => {
        state = 1;
        return 0;
      },
      onSuccess: (n) => {
        state = n;
      },
    });
    expect(result).toBe(42);
    expect(state).toBe(42);
  });

  it('rolls back on error', async () => {
    let state = 'ok';
    const result = await optimisticUpdate({
      mutate: async () => {
        throw new Error('fail');
      },
      onOptimistic: () => {
        state = 'pending';
        return 'ok';
      },
      onError: (_e, rollback) => {
        state = rollback;
      },
    });
    expect(result).toBeNull();
    expect(state).toBe('ok');
  });

  for (let i = 0; i < 20; i++) {
    it(`success path ${i}`, async () => {
      const values: number[] = [];
      await optimisticUpdate({
        mutate: async () => i,
        onOptimistic: () => {
          values.push(-1);
          return 0;
        },
        onSuccess: (n) => values.push(n),
      });
      expect(values).toEqual([-1, i]);
    });
  }
});

describe('createOptimisticHandler', () => {
  it('merges defaults', async () => {
    const handler = createOptimisticHandler<{ v: number }>({ errorDelay: 0 });
    let v = 0;
    await handler({
      mutate: async () => {},
      onOptimistic: () => {
        v = 1;
        return { v: 0 };
      },
    });
    expect(v).toBe(1);
  });
});

describe('UndoManager', () => {
  it('confirms after delay', async () => {
    let confirmed = false;
    const mgr = new UndoManager<string>({ confirmDelay: 50 });
    mgr.add('op1', 'data', async () => {
      confirmed = true;
    });
    await new Promise((r) => setTimeout(r, 80));
    expect(confirmed).toBe(true);
  });

  it('undo cancels confirm', async () => {
    let confirmed = false;
    let undone = false;
    const mgr = new UndoManager<string>({
      confirmDelay: 200,
      onUndo: () => {
        undone = true;
      },
    });
    const undo = mgr.add('op2', 'x', async () => {
      confirmed = true;
    });
    undo();
    await new Promise((r) => setTimeout(r, 250));
    expect(undone).toBe(true);
    expect(confirmed).toBe(false);
  });

  for (let i = 0; i < 15; i++) {
    it(`isPending ${i}`, () => {
      const mgr = new UndoManager<number>({ confirmDelay: 10_000 });
      mgr.add(`id-${i}`, i, async () => {});
      expect(mgr.isPending(`id-${i}`)).toBe(true);
      expect(mgr.cancel(`id-${i}`)).toBe(true);
      expect(mgr.isPending(`id-${i}`)).toBe(false);
    });
  }
});
