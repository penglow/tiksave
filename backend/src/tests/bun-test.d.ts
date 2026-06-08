/** Type declarations for bun:test globals used in backend tests. */
declare module 'bun:test' {
  type TestFn = (name: string, fn: () => void | Promise<void>) => void;

  interface DescribeFn extends TestFn {
    skipIf(condition: boolean): TestFn;
  }

  export const describe: DescribeFn;
  export const it: TestFn;
  export const expect: any;
  export const beforeAll: (fn: () => void | Promise<void>) => void;
  export const afterAll: (fn: () => void | Promise<void>) => void;
  export const beforeEach: (fn: () => void | Promise<void>) => void;
}
