import 'react-native-gesture-handler';
import React, { useEffect, useCallback, useMemo, useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { StyleSheet, useColorScheme, View, Animated as RNAnimated } from 'react-native';
import * as Linking from 'expo-linking';
import { LinearGradient } from 'expo-linear-gradient';

import RootNavigator from './src/navigation/RootNavigator';
import { getThemeColors } from './src/config';
import { useAppStore } from './src/stores/appStore';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import type { AppTheme } from './src/types';
import { extractTikTokUrlFromIncomingUrl } from './src/utils/tiktokUrl';

export default function App() {
  const loadRecentSearches = useAppStore((state) => state.loadRecentSearches);
  const loadUserSettings = useAppStore((state) => state.loadUserSettings);
  const setPendingShareUrl = useAppStore((state) => state.setPendingShareUrl);
  const userSettingsTheme = useAppStore((state) => state.userSettings.theme);
  const systemColorScheme = useColorScheme();
  const [isReady, setIsReady] = useState(false);
  const fadeAnim = useRef(new RNAnimated.Value(0)).current;
  const scaleAnim = useRef(new RNAnimated.Value(0.92)).current;

  // Determine the effective theme
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

  // Initialize app
  useEffect(() => {
    const init = async () => {
      await Promise.all([loadRecentSearches(), loadUserSettings()]);
      // Small delay for splash feel
      setTimeout(() => {
        setIsReady(true);
        RNAnimated.parallel([
          RNAnimated.timing(fadeAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
          RNAnimated.timing(scaleAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ]).start();
      }, 400);
    };
    init();
  }, [loadRecentSearches, loadUserSettings, fadeAnim, scaleAnim]);

  // Handle incoming URL (share intent)
  const handleIncomingUrl = useCallback((url: string) => {
    const tiktokUrl = extractTikTokUrlFromIncomingUrl(url);
    if (tiktokUrl) {
      setPendingShareUrl(tiktokUrl);
    }
  }, [setPendingShareUrl]);

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

  const splashGradient = effectiveTheme === 'dark'
    ? ['#0c0c0e', '#141416'] as const
    : ['#f7f6f3', '#ffffff'] as const;

  return (
    <GestureHandlerRootView style={[styles.container, { backgroundColor: themeColors.background }]}>
      <SafeAreaProvider>
        <ErrorBoundary>
          <StatusBar style={effectiveTheme === 'dark' ? 'light' : 'dark'} />
          <NavigationContainer theme={navigationTheme}>
            {isReady ? (
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
            ) : (
              <LinearGradient colors={splashGradient} style={styles.splash}>
                <RNAnimated.View
                  style={[
                    styles.splashIcon,
                    {
                      backgroundColor: themeColors.accent,
                      transform: [{ scale: scaleAnim }],
                    },
                  ]}
                >
                  <RNAnimated.Text style={[styles.splashIconText, { opacity: fadeAnim }]}>
                    ▶
                  </RNAnimated.Text>
                </RNAnimated.View>
                <RNAnimated.Text
                  style={[
                    styles.splashTitle,
                    { color: themeColors.text, opacity: fadeAnim },
                  ]}
                >
                  TikSave
                </RNAnimated.Text>
                <RNAnimated.Text
                  style={[
                    styles.splashSubtitle,
                    { color: themeColors.textTertiary, opacity: fadeAnim },
                  ]}
                >
                  Organize with AI
                </RNAnimated.Text>
              </LinearGradient>
            )}
          </NavigationContainer>
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  splash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  splashIcon: {
    width: 80,
    height: 80,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  splashIconText: {
    fontSize: 32,
    color: '#ffffff',
    fontWeight: '800',
  },
  splashTitle: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  splashSubtitle: {
    fontSize: 15,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
});
