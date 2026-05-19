---
status: fixing
trigger: "gives a blank screen after a flash of a colored square on running a expo web session"
created: 2026-05-13
updated: 2026-05-13
slug: blank-screen-expo-web
---

## Symptoms

| Field | Value |
|-------|-------|
| **Expected** | App should load fully with navigation and content |
| **Actual** | Splash screen (colored square with ▶ icon) shows briefly, then screen goes blank (white/black) |
| **Error messages** | Console shows no hard errors. Warnings: `shadow*` style props deprecated, `useNativeDriver` not supported on web (falls back to JS animation), API service initialized OK |
| **Timeline** | Recently broke (used to work on web) |
| **Reproduction** | `bun run start` (runs `bunx expo start`), then press `w` for web |

## Environment

- Expo SDK 54
- react-native 0.81.5
- react-native-web ^0.21.0
- @react-navigation/native-stack ^6.9.26 → replaced with @react-navigation/stack ^6.3.20
- react-native-reanimated ~4.1.1
- bun as package manager

## Observations

1. Splash screen (LinearGradient with play icon) renders correctly - means GestureHandlerRootView, SafeAreaProvider, ErrorBoundary, NavigationContainer all mount OK
2. After 400ms delay + 500ms fade animation, `isReady` flips to `true`
3. RootNavigator renders but screen goes blank instead of showing AuthScreen or MainNavigator
4. No error boundary screen shown (no "Something went wrong" message)
5. Console shows app registered successfully: "Running application 'main'"

## Root Cause

`createNativeStackNavigator` from `@react-navigation/native-stack` uses `react-native-screens` for screen rendering. On web, `react-native-screens` silently fails to render screen content, producing an empty container instead of the screen's children. The JS-based `@react-navigation/stack` uses standard React Native Views and renders correctly on web.

## Fix Applied

**File**: `TikSaveRN/src/navigation/RootNavigator.tsx`
- Changed import from `createNativeStackNavigator` (`@react-navigation/native-stack`) to `createStackNavigator` (`@react-navigation/stack`)
- Changed `const Stack = createNativeStackNavigator<...>()` to `createStackNavigator<...>()`
- Replaced native-stack `contentStyle` option with JS-stack `cardStyle`
- Removed `animation: 'fade'` (native-stack-specific, not supported in JS stack; irrelevant since screens are conditionally rendered, not navigated)

## Eliminated

- hypothesis: `@react-navigation/stack` (JS-based) would also be affected by react-native-screens web issues
  evidence: Sub-navigators in MainNavigator (LibraryStack, SearchStack, AddStack, MapStack) already use `createStackNavigator` from `@react-navigation/stack`. The JS stack uses React Native Views for card rendering and react-native-screens only for optional freeze optimization — it does not depend on native screen primitives for content rendering.

- hypothesis: Component import issues from `../components` (AnimatedPressable, GradientButton)
  evidence: All components are properly exported from `components/index.ts` and `useTheme` hook works correctly. ErrorBoundary does not trigger (no JS error was thrown).

## Current Focus

- **Hypothesis**: `createNativeStackNavigator` from `@react-navigation/native-stack` silently produces blank screen on web. Swapping to JS-based `@react-navigation/stack` resolves it.
- **Test**: Run `bun run start` → press `w` for web → observe if AuthScreen or ActivityIndicator appears after splash
- **Next action**: Verify the fix by running the web app
