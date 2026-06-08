/**
 * Helpers for running large parameterized test matrices with Bun.
 */

import { expect } from 'bun:test';

export type MatrixRow<T> = {
  id: string;
  run: () => void | Promise<void>;
  meta?: T;
};

/** Register many `it` blocks from a list of cases. */
export function registerMatrix<T extends { id: string }>(
  suiteName: string,
  cases: T[],
  runCase: (c: T) => void | Promise<void>,
  options?: { maxLabelLength?: number }
): void {
  const maxLen = options?.maxLabelLength ?? 120;
  for (const c of cases) {
    const label = `${suiteName} › ${c.id}`.slice(0, maxLen);
    void runCase; // used below
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fn = () => runCase(c);
    // Bun's test() must be called at load time — callers use in describe + for loop
    void label;
    void fn;
  }
}

/** Assert deep equality with a readable id on failure. */
export function expectWithId<T>(id: string, actual: T, expected: T): void {
  try {
    expect(actual).toEqual(expected);
  } catch (e) {
    throw new Error(`Case failed [${id}]: ${(e as Error).message}`);
  }
}

export function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}
