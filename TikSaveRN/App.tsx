import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { StyleSheet } from 'react-native';

import RootNavigator from './src/navigation/RootNavigator';
import { Colors } from './src/config';
import { useAppStore } from './src/stores/appStore';

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

export default function App() {
  const loadRecentSearches = useAppStore((state) => state.loadRecentSearches);
  const loadUserSettings = useAppStore((state) => state.loadUserSettings);

  useEffect(() => {
    // Load persisted data on app start
    loadRecentSearches();
    loadUserSettings();
  }, [loadRecentSearches, loadUserSettings]);

  return (
    <GestureHandlerRootView style={styles.container}>
      <NavigationContainer theme={DarkTheme}>
        <StatusBar style="light" />
        <RootNavigator />
      </NavigationContainer>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
});

