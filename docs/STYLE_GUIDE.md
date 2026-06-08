# TikSave Style Guide

Conventions for the monorepo (`backend/`, `TikSaveRN/`). Tooling enforces most formatting; this document covers structure and patterns.

## Tooling

| Tool | Scope | Command |
|------|--------|---------|
| Prettier | Repo root | `bun run format` (from `TikSaveRN/` or `backend/`) |
| ESLint | Per package | `bun run lint` |
| TypeScript | Per package | `bun run typecheck` (frontend) |

Run from the package directory (`TikSaveRN/` or `backend/`).

## TypeScript

- **Strict mode** on; avoid `any` (ESLint warns).
- Prefer **named exports** for utilities and hooks; **default export** for screen components (navigator convention).
- Use `interface` for object shapes; use `type` for unions, intersections, and mapped types.
- Prefix intentionally unused parameters with `_`.

## Imports

Use **relative paths** from each file’s location under `src/` (stable with Expo Metro and share-extension bundles):

```ts
import { useTheme } from '../hooks/useTheme';
import { Spacing } from '../config';
import { AnimatedPressable } from '../components';
```

Prefer **barrel files** where they exist (`../components`, `../hooks`, etc.) instead of deep file paths when importing public APIs.

**Order** (blank line between groups):

1. React / React Native / third-party
2. Parent-relative imports (`../config`, `../types`, `../components`, …)
3. Same-directory imports (`./`)

Within each group, sort alphabetically.

`App.tsx` (project root) imports from `./src/...`, not `@/`.

## TikSaveRN layout

```
src/
├── components/     # Reusable UI; export via components/index.ts
├── config/         # API config + design tokens (single index)
├── hooks/          # Custom hooks; export via hooks/index.ts
├── navigation/     # Navigators + param types
├── screens/        # Route screens; export via screens/index.ts
├── services/       # API and platform services
├── stores/         # Zustand stores
├── types/          # Shared types and helpers
├── utils/          # Pure functions
└── share/          # Share extension entry
```

- **Screens** own route-level layout and data loading; extract presentational pieces into `components/` when reused or when a screen exceeds ~400 lines.
- **Platform files**: `*.native.tsx`, `*.web.tsx`, with a thin `MapScreen.tsx` router when needed.
- **Barrel files** (`index.ts`) re-export public APIs only; keep internals in implementation files.

## React components

```tsx
/**
 * Short file-level doc when behavior is non-obvious.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';

import { Spacing } from '@/config';

interface Props {
  title: string;
}

export function ExampleCard({ title }: Props) {
  return <View style={styles.root}>{/* ... */}</View>;
}

const styles = StyleSheet.create({
  root: { padding: Spacing.md },
});
```

- Colocate `StyleSheet.create` at the bottom of the file.
- Design tokens live in `src/config/index.ts` (`Colors`, `Spacing`, `Typography`, etc.) — do not hardcode hex values in screens.
- Use `useTheme()` for theme-aware colors when not using static tokens.

## Backend

```
src/
├── database/       # Migrations, init, seed
├── middleware/
├── routes/
├── services/
├── tests/
├── types/
└── utils/
```

- Route handlers stay thin; business logic in `services/`.
- Validate request bodies with Zod in middleware or route layer.
- Tests mirror source layout under `src/tests/`.

## Naming

| Kind | Convention | Example |
|------|------------|---------|
| Components | PascalCase | `GradientButton.tsx` |
| Hooks | `use` prefix | `usePaginatedItems.ts` |
| Stores | `*Store` | `authStore.ts` |
| Utils | camelCase functions | `tiktokUrl.ts` |
| Constants | PascalCase or UPPER_SNAKE | `Config`, `ACCESS_TOKEN_KEY` |

## Git and commits

- Do not commit `.env`, credentials, or `dist/` / `.expo/` artifacts.
- Prefer focused commits with imperative messages (`fix:`, `feat:`, `chore:`).

## Comments

- File-level block comment when the module’s role isn’t obvious from its path.
- Section dividers in large files: `// --- Section name ---`
- Avoid narrating what the code already says.
