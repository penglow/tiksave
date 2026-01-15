import React, { useEffect, useCallback } from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { StyleSheet } from 'react-native';
import * as Linking from 'expo-linking';

import RootNavigator from './src/navigation/RootNavigator';
import { Colors } from './src/config';
import { useAppStore } from './src/stores/appStore';
import { ErrorBoundary } from './src/components/ErrorBoundary';

// Custom dark theme for navigation
const DarkTheme = {
  ...DefaultTheme,
  dark: true,
  colors: {
    ...DefaultTheme.colors,
    primary: Colors.primary,
    background: Colors.background,
    card: Colors.background,
    text: Colors.text,
    border: Colors.border,
    notification: Colors.error,
  },
};

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

  return (
    <GestureHandlerRootView style={styles.container}>
      <SafeAreaProvider>
        <ErrorBoundary>
          <NavigationContainer theme={DarkTheme}>
            <StatusBar style="light" />
            <RootNavigator />
          </NavigationContainer>
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
});
