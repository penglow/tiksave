---
status: investigating
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
- @react-navigation/native-stack ^6.9.26
- react-native-reanimated ~4.1.1
- bun as package manager

## Observations

1. Splash screen (LinearGradient with play icon) renders correctly - means GestureHandlerRootView, SafeAreaProvider, ErrorBoundary, NavigationContainer all mount OK
2. After 400ms delay + 500ms fade animation, `isReady` flips to `true`
3. RootNavigator renders but screen goes blank instead of showing AuthScreen or MainNavigator
4. No error boundary screen shown (no "Something went wrong" message)
5. Console shows app registered successfully: "Running application 'main'"

## Suspected Root Causes

### Primary: `createNativeStackNavigator` from `@react-navigation/native-stack`
RootNavigator.tsx uses `createNativeStackNavigator` which depends on `react-native-screens`. On web, `react-native-screens` may silently fail to render, producing a blank screen.

### Secondary: `@react-navigation/bottom-tabs` tabBar custom renderer
MainNavigator uses a custom `tabBar` function that calls `useSafeAreaInsets()`. If SafeAreaContext isn't properly initialized for web, this could cause issues.

### Secondary: `react-native-reanimated` on web
MainNavigator uses `useAnimatedStyle` and `withSpring` which require Reanimated's web support. The babel plugin is configured (`react-native-reanimated/plugin`), but runtime issues could occur.

## Current Focus

- **Hypothesis**: `createNativeStackNavigator` from `@react-navigation/native-stack` does not properly render on web, silently producing an empty view
- **Test setup**: Check if swapping to `@react-navigation/stack` (JS-based) resolves the blank screen
- **Next action**: Reproduce the blank screen and verify the hypothesis by testing a simple native-stack screen on web
