import React, { useEffect, useCallback, useMemo, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { StyleSheet, useColorScheme } from 'react-native';
import * as Linking from 'expo-linking';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';

import RootNavigator from './src/navigation/RootNavigator';
import { Colors, getThemeColors } from './src/config';
import { useAppStore } from './src/stores/appStore';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import type { AppTheme } from './src/types';

// Extract TikTok URL from shared text
function extractTikTokUrl(text: string): string | null {
  // Match TikTok URLs
  const patterns = [
    /https?:\/\/(?:www\.)?tiktok\.com\/@[\w.-]+\/video\/\d+[^\s]*/i,
    /https?:\/\/vm\.tiktok\.com\/[\w]+[^\s]*/i,
    /https?:\/\/(?:www\.)?tiktok\.com\/t\/[\w]+[^\s]*/i,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[0];
    }
  }
  
  return null;
}

export default function App() {
  const loadRecentSearches = useAppStore((state) => state.loadRecentSearches);
  const loadUserSettings = useAppStore((state) => state.loadUserSettings);
  const setPendingShareUrl = useAppStore((state) => state.setPendingShareUrl);
  const userSettingsTheme = useAppStore((state) => state.userSettings.theme);
  const systemColorScheme = useColorScheme();

  // #region agent log
  React.useEffect(() => {
    fetch('http://127.0.0.1:7242/ingest/e4b12369-f4da-44c9-b8ec-020b4285b184',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'App.tsx:38',message:'App component render',data:{userSettingsTheme},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'A'})}).catch(()=>{});
  }, [userSettingsTheme]);
  // #endregion

  // Determine the effective theme
  const effectiveTheme: 'light' | 'dark' = useMemo(() => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/e4b12369-f4da-44c9-b8ec-020b4285b184',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'App.tsx:48',message:'effectiveTheme useMemo recalculating',data:{userSettingsTheme,systemColorScheme},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    if (userSettingsTheme === 'system') {
      return systemColorScheme === 'dark' ? 'dark' : 'light';
    }
    return userSettingsTheme;
  }, [userSettingsTheme, systemColorScheme]);

  // Track previous theme for overlay animation
  const [prevTheme, setPrevTheme] = React.useState<'light' | 'dark' | null>(null);
  const prevEffectiveThemeRef = useRef<'light' | 'dark'>(effectiveTheme);
  
  // Animation value for overlay fade transition
  const overlayOpacity = useSharedValue(0);
  const isAnimatingRef = useRef(false);

  // Trigger animation when theme changes
  useEffect(() => {
    // Only animate if theme actually changed and we're not already animating
    if (prevEffectiveThemeRef.current !== effectiveTheme && !isAnimatingRef.current) {
      isAnimatingRef.current = true;
      // Store previous theme for overlay
      setPrevTheme(prevEffectiveThemeRef.current);
      // Fade in overlay (black/white screen) to hide the transition
      overlayOpacity.value = withTiming(1, {
        duration: 200,
        easing: Easing.out(Easing.ease),
      }, () => {
        // Update theme while overlay is fully opaque
        prevEffectiveThemeRef.current = effectiveTheme;
        // Fade out overlay to reveal new theme
        overlayOpacity.value = withTiming(0, {
          duration: 200,
          easing: Easing.in(Easing.ease),
        }, () => {
          setPrevTheme(null);
          isAnimatingRef.current = false;
        });
      });
    }
  }, [effectiveTheme, overlayOpacity]);
  
  // #region agent log
  React.useEffect(() => {
    fetch('http://127.0.0.1:7242/ingest/e4b12369-f4da-44c9-b8ec-020b4285b184',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'App.tsx:50',message:'effectiveTheme value',data:{effectiveTheme},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  }, [effectiveTheme]);
  // #endregion

  // Get theme colors based on effective theme
  const themeColors = useMemo(() => getThemeColors(effectiveTheme === 'dark'), [effectiveTheme]);

  // Create navigation theme based on effective theme
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

  // Handle incoming URL (share intent)
  const handleIncomingUrl = useCallback((url: string) => {
    console.log('Received URL:', url);
    
    // Try to extract TikTok URL from the incoming data
    const tiktokUrl = extractTikTokUrl(url);
    if (tiktokUrl) {
      console.log('Extracted TikTok URL:', tiktokUrl);
      setPendingShareUrl(tiktokUrl);
    }
  }, [setPendingShareUrl]);

  useEffect(() => {
    // Load persisted data on app start
    loadRecentSearches();
    loadUserSettings();

    // Handle URL that launched the app
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

    // Listen for URLs while app is running
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
  }, [loadRecentSearches, loadUserSettings, handleIncomingUrl]);

  // #region agent log
  React.useEffect(() => {
    fetch('http://127.0.0.1:7242/ingest/e4b12369-f4da-44c9-b8ec-020b4285b184',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'App.tsx:132',message:'Render values',data:{effectiveTheme,themeColorsBackground:themeColors.background,navigationThemeDark:navigationTheme.dark,statusBarStyle:effectiveTheme === 'dark' ? 'light' : 'dark'},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'D'})}).catch(()=>{});
  }, [effectiveTheme, themeColors.background, navigationTheme.dark]);
  // #endregion

  // Animated style for overlay transition
  const overlayStyle = useAnimatedStyle(() => {
    return {
      opacity: overlayOpacity.value,
    };
  });

  // Get overlay color (matches the new theme background for smooth transition)
  const overlayColor = themeColors.background;

  return (
    <GestureHandlerRootView style={[styles.container, { backgroundColor: themeColors.background }]}>
      <SafeAreaProvider>
        <ErrorBoundary>
          <NavigationContainer theme={navigationTheme}>
            <StatusBar style={effectiveTheme === 'dark' ? 'light' : 'dark'} />
            <RootNavigator />
            {/* Overlay for smooth theme transition */}
            {prevTheme !== null && (
              <Animated.View 
                style={[
                  styles.overlay,
                  { backgroundColor: overlayColor },
                  overlayStyle
                ]}
                pointerEvents="none"
              />
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
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
  },
});
