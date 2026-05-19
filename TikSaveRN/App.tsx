/**
 * App root
 *
 * Bootstraps gesture handler, theme-aware navigation, animated splash, and deep-link /
 * share-intent URL handling before rendering `RootNavigator`.
 */

import 'react-native-gesture-handler';
import React, { useEffect, useCallback, useMemo, useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { StyleSheet, useColorScheme, View, Animated as RNAnimated, Text, Platform } from 'react-native';
import * as Linking from 'expo-linking';
import { LinearGradient } from 'expo-linear-gradient';

import RootNavigator from './src/navigation/RootNavigator';
import { getThemeColors, Typography, Spacing } from './src/config';
import { useAppStore } from './src/stores/appStore';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { LogoBadge, GrainOverlay, GradientMesh, Wordmark } from './src/components';
import type { AppTheme } from './src/types';
import { extractTikTokUrlFromIncomingUrl } from './src/utils/tiktokUrl';

// -----------------------------------------------------------------------------
// Main app shell
// -----------------------------------------------------------------------------

export default function App() {
  // --- Store selectors --------------------------------------------------------

  const loadRecentSearches = useAppStore((state) => state.loadRecentSearches);
  const loadUserSettings = useAppStore((state) => state.loadUserSettings);
  const setPendingShareUrl = useAppStore((state) => state.setPendingShareUrl);
  const userSettingsTheme = useAppStore((state) => state.userSettings.theme);
  const systemColorScheme = useColorScheme();

  // --- Splash & readiness state -----------------------------------------------

  const [isReady, setIsReady] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const fadeAnim = useRef(new RNAnimated.Value(0)).current;
  const splashOpacity = useRef(new RNAnimated.Value(1)).current;
  const scaleAnim = useRef(new RNAnimated.Value(0.92)).current;
  const useNativeAnimationDriver = Platform.OS !== 'web';

  // --- Theme (effective + navigation) -----------------------------------------

  const effectiveTheme: AppTheme = useMemo(() => {
    if (userSettingsTheme === 'system') {
      return systemColorScheme === 'dark' ? 'dark' : 'light';
    }
    return userSettingsTheme;
  }, [userSettingsTheme, systemColorScheme]);

  const themeColors = useMemo(() => getThemeColors(effectiveTheme === 'dark'), [effectiveTheme]);

  const navigationTheme = useMemo(() => {
    return {
      ...DefaultTheme,
      dark: effectiveTheme === 'dark',
      colors: {
        ...DefaultTheme.colors,
        primary: themeColors.primary,
        background: themeColors.background,
        card: themeColors.background,
        text: themeColors.text,
        border: themeColors.border,
        notification: themeColors.error,
      },
    };
  }, [effectiveTheme, themeColors]);

  // --- Effects: bootstrap persisted state + splash dismiss --------------------

  useEffect(() => {
    const init = async () => {
      await Promise.all([loadRecentSearches(), loadUserSettings()]);
      // Small hold so the stamp animation has time to land before we dismiss.
      setTimeout(() => {
        setIsReady(true);
        RNAnimated.parallel([
          RNAnimated.timing(splashOpacity, {
            toValue: 0,
            duration: 280,
            useNativeDriver: useNativeAnimationDriver,
          }),
          RNAnimated.timing(fadeAnim, {
            toValue: 1,
            duration: 320,
            useNativeDriver: useNativeAnimationDriver,
          }),
          RNAnimated.timing(scaleAnim, {
            toValue: 1,
            duration: 320,
            useNativeDriver: useNativeAnimationDriver,
          }),
        ]).start(() => {
          setShowSplash(false);
        });
      }, 320);
    };
    init();
  }, [loadRecentSearches, loadUserSettings, fadeAnim, splashOpacity, scaleAnim]);

  // --- Handlers: share / deep-link URLs ---------------------------------------

  const handleIncomingUrl = useCallback((url: string) => {
    const tiktokUrl = extractTikTokUrlFromIncomingUrl(url);
    if (tiktokUrl) {
      setPendingShareUrl(tiktokUrl);
    }
  }, [setPendingShareUrl]);

  // --- Effects: Linking subscription ------------------------------------------

  useEffect(() => {
    const getInitialURL = async () => {
      try {
        const initialUrl = await Linking.getInitialURL();
        if (initialUrl) {
          handleIncomingUrl(initialUrl);
        }
      } catch (error) {
        console.error('Failed to get initial URL:', error);
      }
    };
    getInitialURL();

    let subscription: { remove: () => void } | null = null;
    try {
      subscription = Linking.addEventListener('url', (event) => {
        handleIncomingUrl(event.url);
      });
    } catch (error) {
      console.error('Failed to set up URL listener:', error);
    }

    return () => {
      if (subscription) {
        subscription.remove();
      }
    };
  }, [handleIncomingUrl]);

  // --- Derived splash visuals -------------------------------------------------

  const splashGradient = effectiveTheme === 'dark'
    ? ['#0c0c0e', '#141416', '#1a1418'] as const
    : ['#fbf9f6', '#f7f6f3', '#ffffff'] as const;
  const splashMeshBlobs = useMemo(
    () =>
      effectiveTheme === 'dark'
        ? [
            { cx: 0.3, cy: 0.25, r: 0.55, color: '#e8705a', opacity: 0.32 },
            { cx: 0.78, cy: 0.78, r: 0.5, color: '#7c5cff', opacity: 0.18 },
            { cx: 0.5, cy: 0.55, r: 0.4, color: '#fbbf24', opacity: 0.10 },
          ]
        : [
            { cx: 0.3, cy: 0.25, r: 0.55, color: '#f28b78', opacity: 0.35 },
            { cx: 0.78, cy: 0.8, r: 0.5, color: '#fbbf24', opacity: 0.22 },
            { cx: 0.5, cy: 0.55, r: 0.4, color: '#d45a44', opacity: 0.12 },
          ],
    [effectiveTheme],
  );
  const splashPointerEvents = isReady ? 'none' : 'auto';

  // --- Render -----------------------------------------------------------------

  return (
    <GestureHandlerRootView style={[styles.container, { backgroundColor: themeColors.background }]}>
      <SafeAreaProvider>
        <ErrorBoundary>
          <StatusBar style={effectiveTheme === 'dark' ? 'light' : 'dark'} />
          <NavigationContainer theme={navigationTheme}>
            {isReady && (
              <RNAnimated.View
                style={[
                  styles.container,
                  {
                    opacity: fadeAnim,
                    transform: [{ scale: scaleAnim }],
                  },
                ]}
              >
                <RootNavigator />
              </RNAnimated.View>
            )}
            {showSplash && (
              <RNAnimated.View
                style={[
                  StyleSheet.absoluteFill,
                  {
                    opacity: splashOpacity,
                    zIndex: 1,
                    ...(Platform.OS === 'web' ? { pointerEvents: splashPointerEvents } : null),
                  },
                ]}
                {...(Platform.OS === 'web' ? {} : { pointerEvents: splashPointerEvents })}
              >
                <LinearGradient colors={splashGradient} style={styles.splash}>
                  <GradientMesh blobs={splashMeshBlobs} />
                  <GrainOverlay opacity={0.07} baseFrequency={0.9} />

                  <View style={styles.splashContent}>
                    <LogoBadge
                      size={92}
                      background={themeColors.accent}
                      foreground="#ffffff"
                      radius={26}
                      glow
                      entrance="stamp"
                    />

                    <RNAnimated.View
                      style={[styles.splashTextWrap, { opacity: fadeAnim }]}
                    >
                      <Wordmark height={56} color={themeColors.text} />
                      <View style={styles.splashRule}>
                        <View style={[styles.splashRuleLine, { backgroundColor: themeColors.accent }]} />
                      </View>
                      <Text style={[styles.splashSubtitle, { color: themeColors.textTertiary }]}>
                        Organize with AI
                      </Text>
                    </RNAnimated.View>
                  </View>
                </LinearGradient>
              </RNAnimated.View>
            )}
          </NavigationContainer>
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  splash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  splashContent: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.lg,
    zIndex: 2,
  },
  splashTextWrap: {
    alignItems: 'center',
    gap: 4,
  },
  splashRule: {
    height: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 8,
  },
  splashRuleLine: {
    width: 28,
    height: 2,
    borderRadius: 1,
    opacity: 0.85,
  },
  splashSubtitle: {
    ...Typography.label,
    fontSize: 11,
    letterSpacing: 2.4,
    opacity: 0.7,
  },
});
