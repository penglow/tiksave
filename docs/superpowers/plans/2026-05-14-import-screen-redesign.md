# Import Screen Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Import screen as a single-page focused flow with a tactile morph button, inline preview chips, and a fixed set of latent bugs.

**Architecture:** Add reusable `MorphButton` (state machine: idle → submitting → progress → done/error) and `UrlPreviewChip` components. Rewrite `AddVideoScreen` layout to use them; remove `useFocusEffect` cleanup; consolidate triple status/loading/progress UI into the morph button; replace blocking `Alert`/`window.alert` with an inline error chip; broaden URL splitting from `\n` to `[\s,]+`; flatten the nested ScrollViews in the progress section.

**Tech Stack:** React Native (Expo SDK 54), react-native-reanimated v4, react-native-web 0.21, react-navigation v6, TypeScript. No test framework in this project — verification is `bunx tsc --noEmit`, `bunx eslint .`, and a puppeteer-driven web smoke check.

**Reference spec:** `docs/superpowers/specs/2026-05-14-import-screen-redesign-design.md`

---

## File map

| File | Status | Responsibility |
|---|---|---|
| `TikSaveRN/src/config/index.ts` | Modify (Task 1) | Add `Animation.press.fillDuration`/`fillEasing`, `Animation.morph`, `Animation.shake` |
| `TikSaveRN/src/components/MorphButton.tsx` | Create (Task 2) | Self-contained morph button: idle → press-fill → spinner → progress ring → check |
| `TikSaveRN/src/components/UrlPreviewChip.tsx` | Create (Task 3) | One-row preview row with thumb + title + remove button |
| `TikSaveRN/src/components/index.ts` | Modify (Tasks 2, 3) | Export new components |
| `TikSaveRN/src/screens/AddVideoScreen.tsx` | Modify (Tasks 4-7) | New layout + bug fixes |

---

## Task 1: Animation config additions

**Files:**
- Modify: `TikSaveRN/src/config/index.ts:381-423`

- [ ] **Step 1: Add new Animation values**

Open `TikSaveRN/src/config/index.ts`. Replace the `export const Animation = { ... };` block (currently lines 381-423) with this expanded version:

```ts
export const Animation = {
  duration: {
    instant: 40,
    fast: 90,
    normal: 160,
    slow: 260,
    entrance: 300,
    exit: 180,
  },
  spring: {
    /** Crisp UI gestures — taps, toggles, focus rings. */
    snappy: { damping: 24, stiffness: 620, mass: 0.9 },
    /** Default for entrance reveals — quick onset, controlled settle. */
    gentle: { damping: 22, stiffness: 380, mass: 1 },
    /** Playful overshoot — stamp logos, success states. */
    bouncy: { damping: 12, stiffness: 520, mass: 0.9 },
    /** Slow drift — splash motion, background blob movement. */
    soft: { damping: 32, stiffness: 220, mass: 1.1 },
    /** Editorial luxe — used for hero reveals where weight matters. */
    luxe: { damping: 26, stiffness: 360, mass: 1.05 },
    /** Ultra-snap — the FAB, switches, tab pill morph. */
    crisp: { damping: 28, stiffness: 800, mass: 0.7 },
  },
  /** Per-item delay for staggered list entrances. */
  stagger: 32,
  /** Per-word delay for headline reveals. */
  staggerWord: 50,
  /** Per-character delay for kinetic type. */
  staggerChar: 22,
  press: {
    scale: 0.965,
    opacity: 0.88,
    /** Press-fill sweep across primary CTAs (e.g. MorphButton). */
    fillDuration: 180,
    fillEasing: [0.2, 0.8, 0.4, 1] as [number, number, number, number],
  },
  /** Morph-button transitions: text → spinner → ring → check. */
  morph: {
    textFadeDuration: 120,
    morphDuration: 180,
    ringFillSpring: { damping: 18, stiffness: 220, mass: 0.9 },
    doneScaleSpring: { damping: 14, stiffness: 280, mass: 0.6 },
  },
  /** Horizontal shake used to indicate "you tapped a no-op CTA". */
  shake: {
    amplitude: 6,
    duration: 320,
  },
  /** Standard cubic-bezier curves — kept short and intentional. */
  ease: {
    /** Emphasized decelerate — ideal for entrances. */
    out: [0.16, 1, 0.3, 1] as [number, number, number, number],
    /** Standard symmetric — generic transitions. */
    inOut: [0.45, 0, 0.55, 1] as [number, number, number, number],
    /** Sharp accelerate — exits. */
    in: [0.7, 0, 0.84, 0] as [number, number, number, number],
  },
};
```

- [ ] **Step 2: Type-check**

```bash
cd TikSaveRN && bunx tsc --noEmit
```

Expected: 0 errors. (If existing errors unrelated to this change exist, note them but they are not blockers — only this file should produce no NEW errors.)

- [ ] **Step 3: Commit**

```bash
git add TikSaveRN/src/config/index.ts
git commit -m "feat(config): add Animation.press fill, morph, shake values"
```

---

## Task 2: MorphButton component

**Files:**
- Create: `TikSaveRN/src/components/MorphButton.tsx`
- Modify: `TikSaveRN/src/components/index.ts`

- [ ] **Step 1: Create the component file**

Create `TikSaveRN/src/components/MorphButton.tsx` with the following content:

```tsx
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View, StyleSheet, ActivityIndicator, Platform, LayoutChangeEvent } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withSequence,
  withDelay,
  Easing,
  cancelAnimation,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { Animation, BorderRadius, Spacing, Typography } from '../config';
import { useTheme } from '../hooks/useTheme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type MorphState =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'progress'; completed: number; total: number }
  | { kind: 'done' }
  | { kind: 'error' };

interface MorphButtonProps {
  /** Visible label in idle state. e.g. "Import 2 →" or "Paste a link to start". */
  label: string;
  state: MorphState;
  /** 'solid' = filled (active CTA). 'ghost' = outline (no-op CTA — onPress fires onPressGhost). */
  variant: 'solid' | 'ghost';
  /** Fired on tap when variant === 'solid' AND state.kind === 'idle'. */
  onPress?: () => void;
  /** Fired on tap when variant === 'ghost'. Use to trigger a shake on an empty input. */
  onPressGhost?: () => void;
  /** Fired on tap when state.kind === 'progress'. Use to confirm + cancel. */
  onPressProgress?: () => void;
  /** Fired on tap when state.kind === 'error'. Use to retry. */
  onPressRetry?: () => void;
  /** Fire haptic on press-in (native only). */
  haptic?: boolean;
  accessibilityLabel?: string;
}

const BUTTON_HEIGHT = 52;

/**
 * Primary CTA with a state machine: idle → submitting → progress → done.
 * Tap = submit; the press-fill is purely visual feedback.
 */
export function MorphButton({
  label,
  state,
  variant,
  onPress,
  onPressGhost,
  onPressProgress,
  onPressRetry,
  haptic = false,
  accessibilityLabel,
}: MorphButtonProps) {
  const { colors } = useTheme();

  const [parentWidth, setParentWidth] = useState(0);
  const pressFill = useSharedValue(0);
  const morph = useSharedValue(0); // 0 = full-width pill, 1 = circle
  const ring = useSharedValue(0);  // 0..1 progress ring fill (progress state)
  const doneScale = useSharedValue(0);
  const errorFlash = useSharedValue(0);

  const handleLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && Math.abs(w - parentWidth) > 0.5) setParentWidth(w);
  };

  // Drive morph based on state
  useEffect(() => {
    if (state.kind === 'idle') {
      morph.value = withTiming(0, { duration: Animation.morph.morphDuration });
      doneScale.value = withTiming(0, { duration: Animation.duration.fast });
      ring.value = withTiming(0, { duration: Animation.duration.fast });
      errorFlash.value = withTiming(0, { duration: Animation.duration.fast });
      pressFill.value = withTiming(0, { duration: Animation.duration.fast });
    } else if (state.kind === 'submitting') {
      morph.value = withTiming(1, { duration: Animation.morph.morphDuration });
      ring.value = withTiming(0, { duration: Animation.duration.fast });
    } else if (state.kind === 'progress') {
      morph.value = withTiming(1, { duration: Animation.morph.morphDuration });
      const target = state.total > 0 ? state.completed / state.total : 0;
      ring.value = withSpring(target, Animation.morph.ringFillSpring);
    } else if (state.kind === 'done') {
      morph.value = withTiming(1, { duration: Animation.morph.morphDuration });
      ring.value = withSpring(1, Animation.morph.ringFillSpring);
      doneScale.value = withDelay(
        120,
        withSpring(1, Animation.morph.doneScaleSpring),
      );
    } else if (state.kind === 'error') {
      morph.value = withTiming(1, { duration: Animation.morph.morphDuration });
      errorFlash.value = withSequence(
        withTiming(1, { duration: 120, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 240, easing: Easing.in(Easing.quad) }),
      );
    }
    return () => {
      cancelAnimation(morph);
      cancelAnimation(ring);
      cancelAnimation(doneScale);
      cancelAnimation(errorFlash);
    };
  }, [state, morph, ring, doneScale, errorFlash, pressFill]);

  const handlePressIn = () => {
    if (state.kind !== 'idle' && state.kind !== 'error') return;
    if (variant === 'solid') {
      pressFill.value = withTiming(1, {
        duration: Animation.press.fillDuration,
        easing: Easing.bezier(...Animation.press.fillEasing),
      });
    }
    if (haptic && Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
  };

  const handlePressOut = () => {
    pressFill.value = withTiming(0, { duration: Animation.duration.fast });
  };

  const handlePress = () => {
    if (state.kind === 'progress') {
      onPressProgress?.();
      return;
    }
    if (state.kind === 'error') {
      onPressRetry?.();
      return;
    }
    if (state.kind !== 'idle') return;
    if (variant === 'ghost') {
      onPressGhost?.();
    } else {
      onPress?.();
    }
  };

  // Width morph: full parent width → square (BUTTON_HEIGHT) using measured layout
  const containerStyle = useAnimatedStyle(() => {
    if (parentWidth <= 0) {
      // Pre-measure: don't animate, use full width.
      return { width: '100%', alignSelf: 'center' as const };
    }
    const w = interpolate(
      morph.value,
      [0, 1],
      [parentWidth, BUTTON_HEIGHT],
      Extrapolation.CLAMP,
    );
    return { width: w, alignSelf: 'center' as const };
  });

  const fillStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: pressFill.value }],
    opacity: 1 - morph.value,
  }));

  const labelStyle = useAnimatedStyle(() => ({
    opacity: 1 - morph.value,
  }));

  const spinnerStyle = useAnimatedStyle(() => ({
    opacity:
      state.kind === 'submitting' || state.kind === 'progress' ? morph.value : 0,
  }));

  const ringStyle = useAnimatedStyle(() => {
    // Border-conic effect via two semi-circles is hard in RN.
    // Use opacity + scale instead; ProgressArc is a simple radial fill bar.
    return { opacity: state.kind === 'progress' ? 1 : 0 };
  });

  const ringFillStyle = useAnimatedStyle(() => ({
    height: `${ring.value * 100}%`,
  }));

  const doneStyle = useAnimatedStyle(() => ({
    opacity: doneScale.value,
    transform: [{ scale: doneScale.value }],
  }));

  const errorFlashStyle = useAnimatedStyle(() => ({
    opacity: errorFlash.value * 0.6,
  }));

  const solidBg =
    state.kind === 'error' ? colors.error : colors.text;
  const ghostBg = 'transparent';
  const baseBg = variant === 'solid' ? solidBg : ghostBg;
  const fgColor = variant === 'solid' ? colors.background : colors.textSecondary;

  const a11yLabel = useMemo(() => {
    if (accessibilityLabel) return accessibilityLabel;
    switch (state.kind) {
      case 'submitting':
        return 'Submitting';
      case 'progress':
        return `Importing ${state.completed} of ${state.total}, tap to cancel`;
      case 'done':
        return 'Import complete';
      case 'error':
        return 'Import failed, tap to retry';
      default:
        return label;
    }
  }, [state, label, accessibilityLabel]);

  return (
    <View style={styles.outerHost} onLayout={handleLayout}>
    <Animated.View style={[styles.outer, containerStyle]}>
      <AnimatedPressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        accessibilityRole="button"
        accessibilityLabel={a11yLabel}
        style={[
          styles.button,
          {
            backgroundColor: baseBg,
            borderColor: variant === 'ghost' ? colors.border : 'transparent',
          },
        ]}
      >
        {/* Press-fill sweep (left → right). Hidden once morph begins. */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.fill,
            { backgroundColor: colors.accent },
            fillStyle,
          ]}
        />

        {/* Error-flash overlay */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.fill,
            { backgroundColor: colors.error, transform: [{ scaleX: 1 }] },
            errorFlashStyle,
          ]}
        />

        {/* Idle label */}
        <Animated.View style={[styles.labelRow, labelStyle]}>
          <Text style={[styles.labelText, { color: fgColor }]} numberOfLines={1}>
            {label}
          </Text>
        </Animated.View>

        {/* Spinner (submitting) */}
        <Animated.View style={[styles.center, spinnerStyle]} pointerEvents="none">
          <ActivityIndicator size="small" color={colors.background} />
        </Animated.View>

        {/* Progress fill bar (rises bottom → top inside the circle) */}
        <Animated.View style={[styles.center, ringStyle]} pointerEvents="none">
          <View style={styles.ringTrack}>
            <Animated.View
              style={[
                styles.ringFill,
                { backgroundColor: colors.accent },
                ringFillStyle,
              ]}
            />
          </View>
          {state.kind === 'progress' && (
            <Text style={[styles.ringText, { color: colors.background }]}>
              {state.completed}/{state.total}
            </Text>
          )}
        </Animated.View>

        {/* Done check */}
        <Animated.View style={[styles.center, doneStyle]} pointerEvents="none">
          <Ionicons name="checkmark" size={24} color={colors.background} />
        </Animated.View>
      </AnimatedPressable>
    </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  outerHost: {
    width: '100%',
    height: BUTTON_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outer: {
    height: BUTTON_HEIGHT,
  },
  button: {
    flex: 1,
    height: BUTTON_HEIGHT,
    borderRadius: BUTTON_HEIGHT / 2,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fill: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: '100%',
    transformOrigin: 'left center',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
  },
  labelText: {
    ...Typography.bodyStrong,
  },
  center: {
    position: 'absolute',
    inset: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringTrack: {
    position: 'absolute',
    width: BUTTON_HEIGHT - 8,
    height: BUTTON_HEIGHT - 8,
    borderRadius: (BUTTON_HEIGHT - 8) / 2,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    opacity: 0.4,
  },
  ringFill: {
    width: '100%',
  },
  ringText: {
    ...Typography.captionStrong,
    position: 'absolute',
    fontSize: 11,
  },
});

export default MorphButton;
```

- [ ] **Step 2: Export from components index**

Edit `TikSaveRN/src/components/index.ts`. Add this export at the bottom of the existing exports:

```ts
export { MorphButton, type MorphState } from './MorphButton';
```

- [ ] **Step 3: Type-check**

```bash
cd TikSaveRN && bunx tsc --noEmit
```

Expected: 0 errors. If `colors.error` or any used color key is missing from the theme, fix the import or use a defined color.

- [ ] **Step 4: Lint the new file**

```bash
cd TikSaveRN && bunx eslint src/components/MorphButton.tsx
```

Expected: 0 errors. Warnings about unused imports are OK to fix inline.

- [ ] **Step 5: Commit**

```bash
git add TikSaveRN/src/components/MorphButton.tsx TikSaveRN/src/components/index.ts
git commit -m "feat(components): add MorphButton primary CTA"
```

---

## Task 3: UrlPreviewChip component

**Files:**
- Create: `TikSaveRN/src/components/UrlPreviewChip.tsx`
- Modify: `TikSaveRN/src/components/index.ts`

- [ ] **Step 1: Create the component file**

Create `TikSaveRN/src/components/UrlPreviewChip.tsx`:

```tsx
import React from 'react';
import { View, Text, Image, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Spacing, BorderRadius, Typography, Shadows } from '../config';
import { useTheme } from '../hooks/useTheme';
import { AnimatedPressable } from './AnimatedPressable';
import type { TikTokOEmbedPreview } from '../utils/tiktokOEmbed';

interface UrlPreviewChipProps {
  url: string;
  preview?: TikTokOEmbedPreview;
  loading: boolean;
  onRemove: () => void;
}

/** Single-row preview chip used inline below the import input. */
export function UrlPreviewChip({ url, preview, loading, onRemove }: UrlPreviewChipProps) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.row,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <View style={[styles.thumb, { backgroundColor: colors.surfaceHover }]}>
        {preview?.thumbnailUrl ? (
          <Image source={{ uri: preview.thumbnailUrl }} style={styles.thumbImage} />
        ) : loading ? (
          <ActivityIndicator size="small" color={colors.textTertiary} />
        ) : (
          <Ionicons name="play-circle-outline" size={18} color={colors.textTertiary} />
        )}
      </View>

      <View style={styles.text}>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
          {preview?.title || 'TikTok video'}
        </Text>
        <Text style={[styles.url, { color: colors.textTertiary }]} numberOfLines={1}>
          {url}
        </Text>
      </View>

      <AnimatedPressable
        onPress={onRemove}
        accessibilityLabel={`Remove ${preview?.title || url}`}
        accessibilityRole="button"
        style={styles.remove}
      >
        <Ionicons name="close" size={16} color={colors.textTertiary} />
      </AnimatedPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingLeft: Spacing.sm,
    paddingRight: Spacing.xs,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    ...Shadows.xs,
  },
  thumb: {
    width: 36,
    height: 48,
    borderRadius: BorderRadius.sm,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  text: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    ...Typography.captionStrong,
    lineHeight: 16,
  },
  url: {
    ...Typography.caption,
    fontSize: 11,
    marginTop: 2,
  },
  remove: {
    padding: Spacing.xs,
  },
});

export default UrlPreviewChip;
```

- [ ] **Step 2: Export from components index**

Edit `TikSaveRN/src/components/index.ts`. Add at the bottom:

```ts
export { UrlPreviewChip } from './UrlPreviewChip';
```

- [ ] **Step 3: Type-check**

```bash
cd TikSaveRN && bunx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add TikSaveRN/src/components/UrlPreviewChip.tsx TikSaveRN/src/components/index.ts
git commit -m "feat(components): add UrlPreviewChip"
```

---

## Task 4: Rewrite AddVideoScreen — layout & state machine

**Files:**
- Modify: `TikSaveRN/src/screens/AddVideoScreen.tsx` (full file replacement)

This task merges layout, the morph button integration, the bug fixes, and removal of the `useFocusEffect` cleanup into a single rewrite. After this, the screen still uses the existing `apiService`, `useClipboard`, `useAppStore`, and `ProcessingProgress` (the latter only for in-progress per-item rows; the morph button shows aggregate progress).

- [ ] **Step 1: Replace the file**

Open `TikSaveRN/src/screens/AddVideoScreen.tsx`. Replace the ENTIRE contents (currently 972 lines) with:

```tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  Layout,
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';

import {
  Spacing,
  BorderRadius,
  Typography,
  Hairline,
  Shadows,
  TAB_BAR_OVERLAP,
  Animation,
} from '../config';
import { apiService } from '../services/api';
import { useAppStore } from '../stores/appStore';
import { LibraryStackScreenProps, AddStackScreenProps } from '../navigation/types';
import { useTheme } from '../hooks/useTheme';
import { useClipboard } from '../hooks/useClipboard';
import {
  AnimatedPressable,
  LogoMark,
  WordReveal,
  MorphButton,
  type MorphState,
  UrlPreviewChip,
  ProcessingProgress,
} from '../components';
import {
  fetchTikTokOEmbedPreview,
  type TikTokOEmbedPreview,
} from '../utils/tiktokOEmbed';
import { usePaginationCacheStore } from '../stores/paginationCacheStore';

type Props =
  | LibraryStackScreenProps<'AddVideo'>
  | AddStackScreenProps<'AddMain'>;

interface ImportingItem {
  id: string;
  url: string;
  status: 'processing' | 'complete' | 'error';
  generation: number;
}

const URL_SPLIT = /[\s,]+/;
const TIKTOK_HOSTS = ['tiktok.com', 'vm.tiktok'];

function isTikTokUrl(s: string): boolean {
  return TIKTOK_HOSTS.some((h) => s.includes(h));
}

function parseUrls(input: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of input.split(URL_SPLIT)) {
    const u = raw.trim();
    if (!u || seen.has(u)) continue;
    seen.add(u);
    out.push(u);
  }
  return out;
}

export default function AddVideoScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const [manualUrl, setManualUrl] = useState('');
  const [importingItems, setImportingItems] = useState<ImportingItem[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [pendingSubmit, setPendingSubmit] = useState(false);
  const [importStatus, setImportStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [previews, setPreviews] = useState<Record<string, { loading: boolean; data?: TikTokOEmbedPreview }>>({});
  const [howToOpen, setHowToOpen] = useState(false);
  const [cancellingItemIds, setCancellingItemIds] = useState<Set<string>>(new Set());

  const importGenerationRef = useRef(0);
  const finalizedForGenerationRef = useRef<number | null>(null);
  const finalizeInflightRef = useRef(false);
  const errorTimerRef = useRef<NodeJS.Timeout | null>(null);

  const inputShake = useSharedValue(0);

  const pendingShareUrl = useAppStore((state) => state.pendingShareUrl);
  const clearPendingShare = useAppStore((state) => state.clearPendingShare);

  const { urls: clipboardUrls, hasUrls: hasClipboardUrls, dismissUrls, clearUrls } = useClipboard({
    autoCheck: true,
    onlyNew: true,
  });

  const parsedUrls = useMemo(() => parseUrls(manualUrl), [manualUrl]);
  const validUrls = useMemo(() => parsedUrls.filter(isTikTokUrl), [parsedUrls]);

  const showHowTo = manualUrl.length === 0 && !isImporting && importStatus === 'idle';

  // Auto-collapse "how to" when input gets content
  useEffect(() => {
    if (manualUrl.length > 0) setHowToOpen(false);
  }, [manualUrl.length]);

  // Inline-error auto-dismiss
  useEffect(() => {
    if (errorTimerRef.current) {
      clearTimeout(errorTimerRef.current);
      errorTimerRef.current = null;
    }
    if (errorMessage) {
      errorTimerRef.current = setTimeout(() => setErrorMessage(null), 4000);
    }
    return () => {
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    };
  }, [errorMessage]);

  // Clear error when user edits the input
  useEffect(() => {
    if (manualUrl.length > 0) setErrorMessage(null);
  }, [manualUrl]);

  // Debounced oEmbed previews per URL
  useEffect(() => {
    const targets = validUrls.slice(0, 8);
    if (targets.length === 0) {
      setPreviews({});
      return;
    }

    let cancelled = false;
    const handle = setTimeout(() => {
      setPreviews((prev) => {
        const next: typeof prev = {};
        for (const u of targets) {
          next[u] = prev[u] ?? { loading: true };
        }
        return next;
      });

      targets.forEach((url) => {
        // Skip if we already have data
        const existing = previews[url];
        if (existing && existing.data) return;
        void fetchTikTokOEmbedPreview(url).then((data) => {
          if (cancelled) return;
          setPreviews((prev) => ({ ...prev, [url]: { loading: false, data } }));
        });
      });
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manualUrl]);

  const nextImportGeneration = () => {
    importGenerationRef.current += 1;
    finalizedForGenerationRef.current = null;
    return importGenerationRef.current;
  };

  const triggerInputShake = () => {
    inputShake.value = withSequence(
      withTiming(-Animation.shake.amplitude, { duration: 60, easing: Easing.out(Easing.quad) }),
      withTiming(Animation.shake.amplitude, { duration: 60, easing: Easing.inOut(Easing.quad) }),
      withTiming(-Animation.shake.amplitude * 0.6, { duration: 60, easing: Easing.inOut(Easing.quad) }),
      withTiming(Animation.shake.amplitude * 0.4, { duration: 60, easing: Easing.inOut(Easing.quad) }),
      withTiming(0, { duration: 80, easing: Easing.in(Easing.quad) }),
    );
  };

  const inputShakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: inputShake.value }],
  }));

  useEffect(() => () => cancelAnimation(inputShake), [inputShake]);

  const finalizeImportSession = useCallback(
    async (items: ImportingItem[], generation: number) => {
      if (finalizeInflightRef.current) return;
      finalizeInflightRef.current = true;
      try {
        if (
          generation !== importGenerationRef.current ||
          finalizedForGenerationRef.current === generation
        ) {
          return;
        }
        finalizedForGenerationRef.current = generation;

        usePaginationCacheStore.getState().clearAll();

        const successes = items.filter((i) => i.status === 'complete');
        const failures = items.filter((i) => i.status === 'error');

        setImportStatus(successes.length === 0 && failures.length > 0 ? 'error' : 'success');

        await new Promise((r) => setTimeout(r, 750));

        if (generation !== importGenerationRef.current) return;

        const nav = navigation as unknown as {
          navigate: (name: string, params?: Record<string, unknown>) => void;
        };

        if (successes.length === 1 && failures.length === 0) {
          try {
            const saved = await apiService.getItem(successes[0].id);
            nav.navigate('Library', { screen: 'VideoDetail', params: { item: saved } });
          } catch {
            nav.navigate('Library', { screen: 'LibraryMain' });
          }
        } else if (successes.length > 0) {
          nav.navigate('Library', { screen: 'LibraryMain' });
        }

        // Reset local UI back to idle
        setIsImporting(false);
        setImportingItems([]);
        setManualUrl('');
        setPreviews({});
        setPendingSubmit(false);
        setImportStatus('idle');
      } finally {
        finalizeInflightRef.current = false;
      }
    },
    [navigation],
  );

  const updateItemStatus = useCallback(
    (itemId: string, status: 'complete' | 'error') => {
      setImportingItems((prev) => {
        const next = prev.map((i) =>
          i.id === itemId ? { ...i, status } : i,
        );
        const stillWorking = next.some((i) => i.status === 'processing');
        if (!stillWorking && next.length > 0) {
          const gen = next[0].generation;
          setTimeout(() => void finalizeImportSession(next, gen), 0);
        }
        return next;
      });
    },
    [finalizeImportSession],
  );

  const handleSingleImport = async (url: string) => {
    if (!isTikTokUrl(url)) {
      setErrorMessage('That doesn’t look like a TikTok URL.');
      triggerInputShake();
      return;
    }
    const generation = nextImportGeneration();
    setPendingSubmit(true);
    setIsImporting(true);
    setImportStatus('idle');
    setErrorMessage(null);

    try {
      const item = await apiService.createSaveItem(url);
      const queued: ImportingItem = {
        id: item.id,
        url,
        status: 'processing',
        generation,
      };
      setImportingItems([queued]);
      if (item.status === 'ready' || item.status === 'needs_review') {
        setTimeout(() => updateItemStatus(item.id, 'complete'), 0);
      }
    } catch (err) {
      console.error('Failed to import:', err);
      setImportStatus('error');
      setIsImporting(false);
      setErrorMessage('Import failed. Please try again.');
    } finally {
      setPendingSubmit(false);
    }
  };

  const handleBatchImport = async (urls: string[]) => {
    const invalid = urls.filter((u) => !isTikTokUrl(u));
    if (invalid.length > 0) {
      setErrorMessage(`${invalid.length} URL(s) are not TikTok links.`);
      triggerInputShake();
      return;
    }

    const generation = nextImportGeneration();
    setPendingSubmit(true);
    setIsImporting(true);
    setImportStatus('idle');
    setErrorMessage(null);

    try {
      const result = await apiService.batchCreateSaveItems(urls, {
        skipDuplicates: true,
        autoOrganize: true,
      });

      const queued: ImportingItem[] = result.items
        .filter((i) => i.status === 'queued')
        .map((i) => ({
          id: i.id,
          url: i.url,
          status: 'processing',
          generation,
        }));

      setImportingItems(queued);

      if (result.duplicates > 0 || result.errors > 0) {
        setErrorMessage(
          `${result.queued} queued · ${result.duplicates} duplicates · ${result.errors} errors`,
        );
      }

      if (queued.length === 0) {
        setIsImporting(false);
        setPendingSubmit(false);
        const nav = navigation as unknown as {
          navigate: (name: string, params?: Record<string, unknown>) => void;
        };
        nav.navigate('Library', { screen: 'LibraryMain' });
      }
    } catch (err) {
      console.error('Failed to batch import:', err);
      setImportStatus('error');
      setIsImporting(false);
      setErrorMessage('Batch import failed. Please try again.');
    } finally {
      setPendingSubmit(false);
    }
  };

  const handleCancelImport = async (itemId: string) => {
    setCancellingItemIds((prev) => {
      const next = new Set(prev);
      next.add(itemId);
      return next;
    });
    try {
      await apiService.deleteItem(itemId);
      setImportingItems((prev) => {
        const removed = prev.find((i) => i.id === itemId);
        const gen = removed?.generation ?? importGenerationRef.current;
        const next = prev.filter((i) => i.id !== itemId);
        if (next.length === 0) {
          setIsImporting(false);
          setImportStatus('idle');
        } else {
          const stillWorking = next.some((i) => i.status === 'processing');
          if (!stillWorking) {
            setTimeout(() => void finalizeImportSession(next, gen), 0);
          }
        }
        return next;
      });
    } catch (err) {
      console.error(`Failed to cancel ${itemId}:`, err);
    } finally {
      setCancellingItemIds((prev) => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    }
  };

  const handlePrimaryPress = () => {
    if (validUrls.length === 0) return;
    if (validUrls.length === 1) {
      void handleSingleImport(validUrls[0]);
    } else {
      void handleBatchImport(validUrls);
    }
  };

  const handleEmptyPress = () => {
    triggerInputShake();
  };

  const handleProgressPress = () => {
    if (Platform.OS === 'web') {
      const ok = window.confirm('Cancel all in-progress imports?');
      if (!ok) return;
    }
    importingItems
      .filter((i) => i.status === 'processing')
      .forEach((i) => void handleCancelImport(i.id));
  };

  const handleRemoveUrl = (url: string) => {
    const remaining = parsedUrls.filter((u) => u !== url);
    setManualUrl(remaining.join('\n'));
  };

  // Share-extension hand-off
  useEffect(() => {
    if (pendingShareUrl) {
      void handleSingleImport(pendingShareUrl);
      clearPendingShare();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingShareUrl]);

  // Map UI status → MorphState
  const morphState: MorphState = useMemo(() => {
    if (importStatus === 'success') return { kind: 'done' };
    if (importStatus === 'error' && !isImporting) return { kind: 'error' };
    if (pendingSubmit) return { kind: 'submitting' };
    if (isImporting && importingItems.length > 0) {
      const total = importingItems.length;
      const completed = importingItems.filter((i) => i.status !== 'processing').length;
      return { kind: 'progress', completed, total };
    }
    return { kind: 'idle' };
  }, [importStatus, isImporting, importingItems, pendingSubmit]);

  const morphLabel =
    validUrls.length === 0
      ? 'Paste a link to start'
      : `Import ${validUrls.length} →`;

  const morphVariant = validUrls.length === 0 && morphState.kind === 'idle' ? 'ghost' : 'solid';

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + Spacing.md }]}
      keyboardShouldPersistTaps="handled"
    >
      {/* Header */}
      <Animated.View entering={FadeIn.duration(180)} style={styles.header}>
        <View style={styles.brandRow}>
          <LogoMark size={16} color={colors.accent} />
          <Text style={[styles.brandLabel, { color: colors.textTertiary }]}>TIKSAVE · IMPORT</Text>
        </View>
        <WordReveal
          segments={[
            { text: 'Save it for' },
            { text: 'later.', style: { color: colors.accent, fontStyle: 'italic' } },
          ]}
          style={{ ...(styles.title as any), color: colors.text }}
          stagger={45}
        />
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Paste a TikTok link — or eight. We&apos;ll transcribe, tag and file each one.
        </Text>
      </Animated.View>

      {/* Clipboard chip */}
      {hasClipboardUrls && manualUrl.length === 0 && !isImporting && importStatus === 'idle' && (
        <Animated.View
          entering={FadeInDown.duration(180)}
          exiting={FadeOut.duration(120)}
          style={[styles.clipboardChip, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <Ionicons name="clipboard-outline" size={16} color={colors.accent} />
          <AnimatedPressable
            onPress={() => {
              setManualUrl(clipboardUrls.join('\n'));
              clearUrls();
            }}
            style={styles.clipboardChipMain}
            accessibilityLabel={`Use ${clipboardUrls.length} clipboard link${clipboardUrls.length > 1 ? 's' : ''}`}
          >
            <Text style={[styles.clipboardChipText, { color: colors.text }]} numberOfLines={1}>
              {clipboardUrls.length === 1
                ? 'Use clipboard link'
                : `Use ${clipboardUrls.length} clipboard links`}
            </Text>
            <Ionicons name="chevron-forward" size={14} color={colors.textTertiary} />
          </AnimatedPressable>
          <AnimatedPressable
            onPress={dismissUrls}
            style={styles.clipboardChipDismiss}
            accessibilityLabel="Dismiss clipboard suggestion"
          >
            <Ionicons name="close" size={14} color={colors.textTertiary} />
          </AnimatedPressable>
        </Animated.View>
      )}

      {/* Input */}
      {!isImporting && (
        <View style={styles.inputBlock}>
          <Text style={[styles.inputLabel, { color: colors.textTertiary }]}>
            PASTE TIKTOK URLS
          </Text>
          <Animated.View
            style={[
              styles.inputWrapper,
              { borderColor: colors.border, backgroundColor: colors.surface },
              inputShakeStyle,
            ]}
          >
            <TextInput
              style={[styles.input, { color: colors.text }]}
              placeholder={'https://tiktok.com/...\nhttps://tiktok.com/...'}
              placeholderTextColor={colors.textQuaternary}
              value={manualUrl}
              onChangeText={setManualUrl}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              accessibilityLabel="TikTok URLs"
            />
            {manualUrl.length > 0 && (
              <AnimatedPressable
                onPress={() => setManualUrl('')}
                style={styles.clearButton}
                accessibilityLabel="Clear input"
              >
                <Ionicons name="close-circle" size={18} color={colors.textQuaternary} />
              </AnimatedPressable>
            )}
          </Animated.View>

          {parsedUrls.length > 0 && (
            <Text style={[styles.urlCount, { color: colors.textTertiary }]}>
              {parsedUrls.length} URL{parsedUrls.length === 1 ? '' : 's'} detected
              {parsedUrls.length !== validUrls.length
                ? ` · ${parsedUrls.length - validUrls.length} not TikTok`
                : ''}
            </Text>
          )}

          {validUrls.slice(0, 8).map((url) => (
            <Animated.View
              key={url}
              entering={FadeInDown.duration(160)}
              exiting={FadeOut.duration(120)}
              layout={Layout.springify().damping(20).stiffness(220)}
              style={styles.previewRow}
            >
              <UrlPreviewChip
                url={url}
                preview={previews[url]?.data}
                loading={previews[url]?.loading ?? true}
                onRemove={() => handleRemoveUrl(url)}
              />
            </Animated.View>
          ))}
        </View>
      )}

      {/* In-progress list (replaces input area while importing) */}
      {isImporting && importingItems.length > 0 && (
        <View style={styles.inputBlock}>
          <Text style={[styles.inputLabel, { color: colors.textTertiary }]}>
            IMPORTING {importingItems.length} VIDEO{importingItems.length === 1 ? '' : 'S'}
          </Text>
          {importingItems.map((item) => (
            <Animated.View
              key={item.id}
              entering={FadeIn.duration(180)}
              style={styles.importingRow}
            >
              <ImportingItemRow
                item={item}
                isCancelling={cancellingItemIds.has(item.id)}
                onComplete={() => updateItemStatus(item.id, 'complete')}
                onError={(msg) => {
                  console.error(`Import ${item.id}:`, msg);
                  updateItemStatus(item.id, 'error');
                }}
                onCancel={() => handleCancelImport(item.id)}
              />
            </Animated.View>
          ))}
        </View>
      )}

      {/* Inline error chip */}
      {errorMessage && (
        <Animated.View
          entering={FadeInDown.duration(160)}
          exiting={FadeOut.duration(120)}
          style={[styles.errorChip, { backgroundColor: colors.errorSubtle, borderColor: colors.error }]}
        >
          <Ionicons name="alert-circle-outline" size={16} color={colors.error} />
          <Text style={[styles.errorText, { color: colors.error }]} numberOfLines={2}>
            {errorMessage}
          </Text>
        </Animated.View>
      )}

      {/* Primary CTA */}
      <View style={styles.ctaRow}>
        <MorphButton
          label={morphLabel}
          state={morphState}
          variant={morphVariant}
          onPress={handlePrimaryPress}
          onPressGhost={handleEmptyPress}
          onPressProgress={handleProgressPress}
          onPressRetry={handlePrimaryPress}
          haptic
        />
      </View>

      {/* Collapsed "How to share" accordion */}
      {showHowTo && (
        <Animated.View entering={FadeIn.duration(160)} style={styles.howTo}>
          <AnimatedPressable
            onPress={() => setHowToOpen((v) => !v)}
            style={[styles.howToHeader, { borderColor: colors.border }]}
            accessibilityRole="button"
            accessibilityLabel={howToOpen ? 'Hide how-to' : 'Show how to share from TikTok'}
          >
            <Ionicons
              name={howToOpen ? 'chevron-down' : 'chevron-forward'}
              size={14}
              color={colors.textTertiary}
            />
            <Text style={[styles.howToHeaderText, { color: colors.textSecondary }]}>
              How to share from TikTok
            </Text>
          </AnimatedPressable>
          {howToOpen && (
            <Animated.View entering={FadeInDown.duration(160)} style={styles.howToBody}>
              <StepItem number={1} text="Open TikTok app" />
              <StepItem number={2} text="Tap share on a video" />
              <StepItem number={3} text="Select TikSave" />
              <StepItem number={4} text="Automatically organized" />
            </Animated.View>
          )}
        </Animated.View>
      )}
    </ScrollView>
  );
}

function StepItem({ number, text }: { number: number; text: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.stepItem}>
      <View style={[styles.stepNumberWrapper, { backgroundColor: colors.surfaceHover }]}>
        <Text style={[styles.stepNumber, { color: colors.textSecondary }]}>{number}</Text>
      </View>
      <Text style={[styles.stepText, { color: colors.text }]}>{text}</Text>
    </View>
  );
}

function ImportingItemRow({
  item,
  isCancelling,
  onComplete,
  onError,
  onCancel,
}: {
  item: ImportingItem;
  isCancelling: boolean;
  onComplete: () => void;
  onError: (msg: string) => void;
  onCancel: () => void;
}) {
  const { colors } = useTheme();
  if (item.status === 'processing') {
    return (
      <ProcessingProgress
        itemId={item.id}
        onComplete={onComplete}
        onError={onError}
        onCancel={onCancel}
        isCancelling={isCancelling}
        pollInterval={500}
      />
    );
  }
  if (item.status === 'complete') {
    return (
      <View style={[styles.statusCard, { backgroundColor: colors.successSubtle, borderColor: colors.successSubtle }]}>
        <Ionicons name="checkmark-circle" size={18} color={colors.success} />
        <Text style={[styles.statusText, { color: colors.success }]} numberOfLines={1}>
          Complete
        </Text>
      </View>
    );
  }
  return (
    <View style={[styles.statusCard, { backgroundColor: colors.errorSubtle, borderColor: colors.errorSubtle }]}>
      <Ionicons name="close-circle" size={18} color={colors.error} />
      <Text style={[styles.statusText, { color: colors.error }]} numberOfLines={1}>
        Failed
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 0,
  },
  content: {
    padding: Spacing.md,
    paddingBottom: Spacing.xxl + TAB_BAR_OVERLAP,
    gap: Spacing.md,
  },

  // Header
  header: {
    gap: Spacing.xs,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  brandLabel: {
    ...Typography.label,
    fontSize: 10,
    letterSpacing: 1.6,
  },
  title: {
    ...Typography.displayMd,
    fontSize: 32,
    lineHeight: 36,
  },
  subtitle: {
    ...Typography.body,
    marginTop: Spacing.xs,
    maxWidth: 360,
  },

  // Clipboard chip
  clipboardChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: Spacing.md,
    paddingRight: Spacing.xs,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    gap: Spacing.sm,
    ...Shadows.xs,
  },
  clipboardChipMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.xs,
  },
  clipboardChipText: {
    ...Typography.bodySm,
    fontWeight: '600',
    flex: 1,
  },
  clipboardChipDismiss: {
    padding: Spacing.xs,
  },

  // Input block
  inputBlock: {
    gap: Spacing.sm,
  },
  inputLabel: {
    ...Typography.label,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
    minHeight: 100,
    ...Shadows.xs,
  },
  input: {
    flex: 1,
    ...Typography.body,
    paddingVertical: 0,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  clearButton: {
    padding: Spacing.xs,
  },
  urlCount: {
    ...Typography.caption,
  },
  previewRow: {
    // wrapper for layout animation
  },

  importingRow: {
    // wrapper for layout animation
  },

  // Status sub-cards
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  statusText: {
    ...Typography.bodyStrong,
    flex: 1,
  },

  // Inline error
  errorChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  errorText: {
    ...Typography.bodySm,
    flex: 1,
  },

  // CTA
  ctaRow: {
    marginTop: Spacing.xs,
  },

  // How-to accordion
  howTo: {
    marginTop: Spacing.lg,
    gap: Spacing.sm,
  },
  howToHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingTop: Spacing.md,
    borderTopWidth: Hairline,
  },
  howToHeaderText: {
    ...Typography.bodySm,
    fontWeight: '600',
  },
  howToBody: {
    gap: Spacing.sm,
    paddingLeft: Spacing.md,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  stepNumberWrapper: {
    width: 24,
    height: 24,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumber: {
    ...Typography.captionStrong,
    fontSize: 12,
  },
  stepText: {
    ...Typography.bodySm,
  },
});
```

- [ ] **Step 2: Type-check**

```bash
cd TikSaveRN && bunx tsc --noEmit
```

Expected: 0 NEW errors from `AddVideoScreen.tsx`. If `Gradients` was the only consumer of an existing import you removed, that's intentional — leave it. If a config key like `Spacing.xxl` doesn't exist, swap to the closest available (`Spacing.xl`).

- [ ] **Step 3: Lint**

```bash
cd TikSaveRN && bunx eslint src/screens/AddVideoScreen.tsx
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add TikSaveRN/src/screens/AddVideoScreen.tsx
git commit -m "feat(import): rewrite AddVideoScreen with MorphButton + chip previews"
```

---

## Task 5: Web smoke test — empty/idle state

Verify the redesigned screen renders, the morph button shows "Paste a link to start" in ghost variant, and tapping it shakes the input.

**Files:**
- Create: `TikSaveRN/scripts/smoke-import.mjs`

- [ ] **Step 1: Find a dev-mode Expo port**

Run:

```bash
for p in 8081 8083 8090 8099 8100 8101; do code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$p/ 2>/dev/null); echo "Port $p: $code"; done
```

Pick a port that returns 200. Confirm it serves a fresh bundle by editing this file with a unique comment, then re-fetching the bundle and grepping for the comment string. If no port has live HMR, ask the user to start one with `bun run web --port 8099`.

- [ ] **Step 2: Create the smoke-test script**

Create `TikSaveRN/scripts/smoke-import.mjs`:

```js
import puppeteer from 'puppeteer-core';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = process.env.PORT || '8099';
const OUT = process.env.OUT || 'C:/Users/abdul/Music/tiksave/tiksave/.run-logs';

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

const page = await browser.newPage();
await page.setViewport({ width: 420, height: 900, deviceScaleFactor: 1 });
const errs = [];
page.on('pageerror', (e) => errs.push(`[pageerror] ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error') errs.push(`[console.error] ${m.text()}`);
});

await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle2', timeout: 60000 });
await new Promise((r) => setTimeout(r, 3000));

// Sign up
const email = `t${Date.now()}@x.com`;
const password = 'password123';
await page.evaluate((e, p) => {
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  const ins = document.querySelectorAll('input');
  if (ins[0]) { set.call(ins[0], e); ins[0].dispatchEvent(new Event('input', { bubbles: true })); }
  if (ins[1]) { set.call(ins[1], p); ins[1].dispatchEvent(new Event('input', { bubbles: true })); }
}, email, password);
await new Promise((r) => setTimeout(r, 300));
await page.evaluate(() => {
  const link = Array.from(document.querySelectorAll('*')).find((el) => el.textContent?.trim() === 'Create one');
  link?.click();
});
await new Promise((r) => setTimeout(r, 300));
await page.evaluate(() => {
  const btn = Array.from(document.querySelectorAll('*')).find((el) => {
    const t = el.textContent?.trim();
    return t === 'Sign Up' || t === 'Create Account' || t === 'Create account';
  });
  btn?.click();
});
await new Promise((r) => setTimeout(r, 3500));

// Navigate to Import via the empty-state CTA
await page.evaluate(() => {
  const btn = Array.from(document.querySelectorAll('*')).find((el) => {
    const t = el.textContent?.trim();
    return t === '+ Import videos' || t === 'Import videos';
  });
  if (btn) {
    let cur = btn;
    for (let i = 0; i < 4 && cur; i++) { cur.click?.(); cur = cur.parentElement; }
  }
});
await new Promise((r) => setTimeout(r, 2000));

await page.screenshot({ path: `${OUT}/import-empty.png` });

// Check for the ghost CTA label
const ghostVisible = await page.evaluate(() => {
  return Array.from(document.querySelectorAll('*')).some((el) =>
    el.textContent?.trim() === 'Paste a link to start',
  );
});
console.log('ghost label present:', ghostVisible);

// Type URLs and screenshot
await page.evaluate(() => {
  const inp = Array.from(document.querySelectorAll('textarea, input')).find((i) =>
    i.placeholder?.includes('tiktok'),
  );
  if (inp) {
    const proto = inp.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const set = Object.getOwnPropertyDescriptor(proto, 'value').set;
    set.call(inp, 'https://www.tiktok.com/@a/video/1\nhttps://www.tiktok.com/@b/video/2');
    inp.dispatchEvent(new Event('input', { bubbles: true }));
  }
});
await new Promise((r) => setTimeout(r, 1500));
await page.screenshot({ path: `${OUT}/import-with-urls.png` });

const importLabel = await page.evaluate(() => {
  return Array.from(document.querySelectorAll('*')).some((el) =>
    el.textContent?.trim() === 'Import 2 →',
  );
});
console.log('import label present:', importLabel);

if (errs.length > 0) {
  console.log('ERRORS:');
  console.log(errs.join('\n'));
}

await browser.close();
```

- [ ] **Step 3: Run the smoke test**

```bash
cd TikSaveRN && PORT=<your_port> node scripts/smoke-import.mjs
```

Expected output:
```
ghost label present: true
import label present: true
```
No `ERRORS:` block. Two PNGs saved to `.run-logs/`.

- [ ] **Step 4: Visually verify the screenshots**

Open `.run-logs/import-empty.png` and `.run-logs/import-with-urls.png`. Confirm:
- Empty: header + clipboard chip (if clipboard active) + empty input + ghost outline button "Paste a link to start" + collapsed "How to share from TikTok ›".
- Two URLs: input populated, "2 URLs detected", two `UrlPreviewChip` rows, solid filled "Import 2 →" button.

If layout looks broken (e.g. button collapsed to 0 width), check `MorphButton` `containerStyle`'s width interpolation — `width: '${number}%'` may not be honored on web; switch to a numeric `width` derived from a ref-measured parent OR use `transform` morph instead.

- [ ] **Step 5: Commit the script**

```bash
git add TikSaveRN/scripts/smoke-import.mjs
git commit -m "test(import): add web smoke test"
```

---

## Task 6: Manual interaction verification

This is a checklist run against the live web app. No new code — just systematic clicking and observing.

- [ ] **Step 1: Empty press shakes input**

In a real browser at the dev port: open Import. Click "Paste a link to start". The input box should translate left/right and settle. No submit.

- [ ] **Step 2: Single import flow**

Paste one valid TikTok URL. Button becomes "Import 1 →" solid. Click it. Button morphs to circle with spinner; after backend response, ring fills 0→1, then check appears, then navigates to the video detail page.

- [ ] **Step 3: Batch import flow**

Paste two valid URLs (or paste a list separated by spaces — test broadened splitter). Button shows "Import 2 →". Click. Morph → progress ring shows `0/2` → `1/2` → `2/2` → check → navigates to library.

- [ ] **Step 4: Tab-switch persistence**

Start a single import. While it's still showing the spinner, click Library tab. Click back to Import (via the + tab if reachable; otherwise via Library's empty-state "Import videos" CTA). The progress indicator should still show the in-progress import. (This is the bug-fix: previously `useFocusEffect` cleanup wiped this.)

- [ ] **Step 5: Cancel flow**

Start a batch of 2. Click the morph button mid-progress. Web `confirm` dialog appears; click OK. Both items cancel; button returns to ghost "Paste a link to start" (input is now empty).

- [ ] **Step 6: Invalid URL inline error**

Paste `not a url`. Button should still be ghost (no valid URLs). Click → input shakes. Or paste a non-TikTok URL like `https://youtube.com/watch?v=x` — counter shows "1 URL detected · 1 not TikTok"; clicking import shakes input and shows error chip.

- [ ] **Step 7: Clipboard chip**

If clipboard contains a TikTok URL on page load, the chip should appear. Click it → input populates → chip disappears.

If any step fails, file the issue clearly with which step failed and observed vs expected; do not commit a "fix" without re-running the relevant Task 4/5 steps.

---

## Task 7: Cleanup & final commit

- [ ] **Step 1: Type-check the whole project**

```bash
cd TikSaveRN && bunx tsc --noEmit
```

Expected: 0 NEW errors compared to before this plan started. Pre-existing errors are not blockers.

- [ ] **Step 2: Lint**

```bash
cd TikSaveRN && bunx eslint src/screens/AddVideoScreen.tsx src/components/MorphButton.tsx src/components/UrlPreviewChip.tsx
```

Expected: 0 errors.

- [ ] **Step 3: Verify no leftover references**

```bash
grep -rn "ProcessingProgress" TikSaveRN/src --include='*.ts*' | head
grep -rn "AnimatedListItem" TikSaveRN/src/screens/AddVideoScreen.tsx | head
grep -rn "fetchTikTokOEmbedPreview" TikSaveRN/src --include='*.ts*' | head
```

Expected:
- `ProcessingProgress` still imported by AddVideoScreen.tsx (used in ImportingItemRow). OK.
- `AnimatedListItem` should NOT appear in AddVideoScreen.tsx (was removed in Task 4).
- `fetchTikTokOEmbedPreview` still imported.

- [ ] **Step 4: Update memory if there's a non-obvious lesson**

If implementation surfaced an unexpected pattern (e.g. "Reanimated layout animations are unreliable on react-native-web inside ScrollView"), save a `feedback` memory. Otherwise skip.

- [ ] **Step 5: Final summary commit (only if outstanding tweaks)**

If any inline tweaks were made during smoke testing:

```bash
git add -p
git commit -m "fix(import): address smoke-test findings"
```

---

## Done criteria

- All 7 tasks have all checkboxes ticked
- `bunx tsc --noEmit` shows no new errors
- `import-empty.png` and `import-with-urls.png` look like the spec layout
- Manual checklist (Task 6) passes step-for-step
- The 6 bugs called out in the spec are all confirmed fixed:
  1. State persists across tab switches ✓
  2. Empty-input tap shakes the input (not silent) ✓
  3. No `window.alert`/`Alert.alert` calls in error paths ✓
  4. Space/comma-separated URLs route to batch import ✓
  5. No nested ScrollViews around the importing list ✓
  6. Single morph button reflects all import states (no triple status duplication) ✓
