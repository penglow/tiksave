# Import Screen Redesign — Design

**Status:** approved-design
**Date:** 2026-05-14
**Scope:** TikSaveRN/src/screens/AddVideoScreen.tsx and supporting components

## Goal

Replace the current Import screen with a single-page focused flow that has tactile, responsive button feedback and clearer state transitions. Fix latent bugs while restructuring.

## Non-goals

- No change to backend import API (`apiService.createSaveItem`, `batchCreateSaveItems`).
- No change to share-extension hand-off contract.
- No change to other screens.

## Layout

Single-page flow, top-to-bottom. The screen lives inside the existing `AddStack` and `LibraryStack` "AddVideo" routes, so the navigator header stays.

```
← Import                         (navigator header — unchanged)

TIKSAVE · IMPORT                 (brand row — unchanged)
Save it for later.               (WordReveal headline — unchanged)
Paste a TikTok link — or eight.  (subtitle — unchanged)

[ 📋 Use clipboard (3) ›  × ]    Compact chip; replaces large banner.
                                 Only when clipboard has new TikTok URLs
                                 AND the input is empty.

┌─────────────────────────────┐
│ Paste link(s) here…         │  Multiline input. Auto-grows up to 6 lines.
│                             │  Subtle shake animation when user submits empty.
└─────────────────────────────┘
2 URLs detected                  Only when input has content.

▶ vid1 thumb · @creator    [×]   Live preview chips. Tap × removes the URL
▶ vid2 thumb · @creator    [×]   from the input. Debounced 250ms oEmbed fetch.

╔═════════════════════════════╗
║   Import 2  →               ║  Morph button (see below).
╚═════════════════════════════╝

▾ How to share from TikTok       Collapsed accordion. Auto-collapses when
                                 input has content.
```

When import is in progress the input/preview/instructions area is replaced by a progress list (see "In-progress state").

## Morph button mechanic

A new `MorphButton` component encapsulates these states:

| State | Appearance | Interaction |
|---|---|---|
| Empty input | Ghost outline, "Paste a link to start" | Tap → shake the input box (no submit) |
| Has URLs | Solid filled, "Import N →" | Tap → morph |
| Morphing | Text fades out (120ms), width shrinks to height (180ms cubic-bezier) | Non-interactive |
| Importing (single) | Circular spinner inside the morph circle | Tap → confirm dialog → cancel |
| Importing (batch) | Circular progress ring; ring fill = completed/total | Tap → confirm dialog → cancel |
| Done | Spinner/ring → checkmark (200ms scale-in) | Non-interactive (auto-navigates ~600ms later) |
| Failed | Ring flashes accent-error then morphs back to "Try again" | Tap → re-submit |

Press feedback during the "Has URLs" state:
- On press-in: scale to 0.96; background starts filling with `colors.accent` from left to right (180ms cubic-bezier).
- On press-out (release): submit fires regardless of fill progress; button transitions to morph. If release happens after the fill finishes, no visual change — fill stays full until morph begins.

Tap = submit. The fill is purely visual feedback during the press; releasing early does NOT cancel.

## Components

### New: `src/components/MorphButton.tsx`

```ts
type MorphState =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'progress'; completed: number; total: number }
  | { kind: 'done' }
  | { kind: 'error' };

interface MorphButtonProps {
  label: string;            // "Import 2 →" or "Paste a link to start"
  state: MorphState;
  variant: 'solid' | 'ghost';
  onPress?: () => void;     // ignored when ghost
  onPressDisabled?: () => void; // for ghost — fires shake on input
  onCancel?: () => void;    // optional cancel during progress
}
```

Internally uses Reanimated shared values for: `pressFill` (0..1), `morphProgress` (0..1), `ringFill` (0..1).

### New: `src/components/UrlPreviewChip.tsx`

```ts
interface UrlPreviewChipProps {
  url: string;
  preview?: TikTokOEmbedPreview;
  loading: boolean;
  onRemove: () => void;
}
```

Renders the thumbnail + title + remove button. Same visual language as the current preview card but smaller, single-row.

### Modified: `src/screens/AddVideoScreen.tsx`

- Remove the `useFocusEffect` cleanup that wipes import state.
- Remove duplicate state-card branches (`isImporting && importingItems.length === 0`, `importStatus === 'success' | 'error'` blocks). Subsume them into the `MorphButton` state machine.
- Replace `Alert.alert` / `window.alert` calls with an inline error message rendered above the morph button.
- Split URLs by `/[\s,]+/` (whitespace AND commas) instead of just `\n`. Anything with more than one URL goes through `handleBatchImport`.
- Auto-collapse the "How to share from TikTok" accordion when `manualUrl.length > 0`.
- Replace the inner `<ScrollView>` for the progress list with a flat list rendered directly inside the outer `ScrollView`. Keeps single scroll context.

### Reused as-is

- `useClipboard` hook (logic unchanged; just rendered as a chip instead of a banner)
- `apiService.createSaveItem`, `batchCreateSaveItems`, `deleteItem`
- `ProcessingProgress` component (used inside the morph button's progress state)
- `useAppStore` `pendingShareUrl` flow

## In-progress state

When `isImporting === true`:

```
TIKSAVE · IMPORT
Save it for later.

Importing 2                       (heading)

▶ vid1 thumb · @creator    [⋯]    Per-item: shows ProcessingProgress
▶ vid2 thumb · @creator    [✓]    or final state, with cancel × that
                                  becomes ✓ or ✕ on completion.

╔═════════════════════════════╗
║          ◐ 1/2              ║   Morph button in 'progress' state.
╚═════════════════════════════╝   Tap = confirm-cancel.
```

Persistence: `useFocusEffect` cleanup is removed, so navigating away & back keeps the same progress visible. Auto-navigate on completion still fires from `finalizeImportSession`.

## Bugs fixed

1. **State wiped on tab switch** — Remove `useFocusEffect` cleanup. (Confirmed with user; in-progress state persists across tabs.)
2. **Silent disabled button** — `MorphButton` ghost variant always responds to taps with a shake on the input. No more dead `disabled` state.
3. **Intrusive `window.alert`** — Inline error row above the button. Auto-dismisses after 4s or when user edits the input.
4. **Single vs batch detection** — Split on `/[\s,]+/`; any input with 2+ URLs uses the batch endpoint.
5. **Nested ScrollViews** — Progress list rendered inline; `ProcessingProgress` does not need its own scroll container.
6. **Status duplication** — Three places reported "importing" / "success" / "error" status (status card, progress section, button). Consolidate into the morph button's state machine.

## Animation values

Add to `src/config/index.ts` `Animation` object:

```ts
press: {
  ...existing,
  fillDuration: 180,
  fillEasing: Easing.bezier(0.2, 0.8, 0.4, 1),
},
morph: {
  textFadeDuration: 120,
  morphDuration: 180,
  ringFillSpring: { damping: 18, stiffness: 220, mass: 0.9 },
  doneScaleSpring: { damping: 14, stiffness: 280, mass: 0.6 },
},
shake: {
  amplitude: 6,    // px
  duration: 320,   // total
},
```

## Testing

Manual on web (existing puppeteer harness):
- Empty input → tap button → input shakes, no submit.
- One URL → tap → morph → progress → checkmark → navigate.
- Three URLs → tap → morph → progress ring fills 0→1 → checkmark → navigate to library.
- During progress → tap ring → confirm cancel → button restores.
- Tab away during import → return → progress still visible.
- Paste invalid URL → inline error chip → input edit clears the chip.
- Clipboard URL detected → chip appears → tap chip → input populated → chip disappears.

Manual on native (iOS/Android):
- Hold-and-release-before-fill → press cancellation works.
- Haptic on tap (existing AnimatedPressable haptic prop, propagated to MorphButton).
- Share-extension hand-off: incoming URL → auto-imports as before.

## Out of scope

- Folder picker or tag input on the import screen (existing AI auto-categorize stays).
- Drag-and-drop URL on web.
- A "recent imports" list.
- Retry failed items individually (current behavior: whole batch finalizes; user re-imports failed URLs manually).
