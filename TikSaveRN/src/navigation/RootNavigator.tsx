/**
 * Root navigator: auth gate and loading splash before Main tab shell.
 */

import React, { useEffect } from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { ActivityIndicator, View, StyleSheet } from 'react-native';

import { RootStackParamList } from './types';
import { useAuthStore } from '../stores/authStore';
import { useTheme } from '../hooks/useTheme';

import AuthScreen from '../screens/AuthScreen';
import MainNavigator from './MainNavigator';

// ---------------------------------------------------------------------------
// Navigator
// ---------------------------------------------------------------------------

const Stack = createStackNavigator<RootStackParamList>();

/** Top-level stack that switches between Auth and Main based on session state. */
export default function RootNavigator() {
  const { isAuthenticated, isInitialized, initialize } = useAuthStore();
  const { colors: themeColors } = useTheme();

  useEffect(() => {
    initialize();
  }, [initialize]);

  if (!isInitialized) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: themeColors.background }]}>
        <ActivityIndicator size="large" color={themeColors.primary} />
      </View>
    );
  }

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        cardStyle: { backgroundColor: themeColors.background },
      }}
    >
      {isAuthenticated ? (
        <Stack.Screen name="Main" component={MainNavigator} />
      ) : (
        <Stack.Screen name="Auth" component={AuthScreen} />
      )}
    </Stack.Navigator>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
