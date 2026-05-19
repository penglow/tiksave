/**
 * Theme hook that resolves user preference (light/dark/system) into design tokens.
 */

import { useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { useAppStore } from '../stores/appStore';
import { getThemeColors } from '../config';

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Get theme-aware colors based on user settings.
 * Resolves `'system'` theme by checking the device color scheme.
 */
export function useTheme() {
  const userSettings = useAppStore((state) => state.userSettings);
  const systemColorScheme = useColorScheme();

  const effectiveTheme = useMemo(() => {
    if (userSettings.theme === 'system') {
      return systemColorScheme === 'dark' ? 'dark' : 'light';
    }
    return userSettings.theme;
  }, [userSettings.theme, systemColorScheme]);

  const colors = useMemo(
    () => getThemeColors(effectiveTheme === 'dark'),
    [effectiveTheme],
  );

  return {
    colors,
    isDark: effectiveTheme === 'dark',
    theme: effectiveTheme,
  };
}
