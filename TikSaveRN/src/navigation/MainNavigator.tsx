/**
 * Main tab navigator with custom floating tab bar, nested stacks, and animated Add FAB.
 */

import React, { useEffect, useRef, useState } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator, CardStyleInterpolators } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { View, StyleSheet, Platform, Pressable, Text, LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
} from 'react-native-reanimated';

import {
  MainTabParamList,
  LibraryStackParamList,
  SearchStackParamList,
  AddStackParamList,
  MapStackParamList,
  LibraryStackScreenProps,
} from './types';
import { Spacing, BorderRadius, Shadows, Animation } from '../config';
import { useTheme } from '../hooks/useTheme';

// Screens
import LibraryScreen from '../screens/LibraryScreen';
import CategoryDetailScreen from '../screens/CategoryDetailScreen';
import AddVideoScreen from '../screens/AddVideoScreen';
import SearchScreen from '../screens/SearchScreen';
import MapScreen from '../screens/MapScreen';
import SettingsScreen from '../screens/SettingsScreen';
import VideoDetailScreen from '../screens/VideoDetailScreen';
import FolderDetailScreen from '../screens/FolderDetailScreen';

// ---------------------------------------------------------------------------
// Navigators
// ---------------------------------------------------------------------------

const Tab = createBottomTabNavigator<MainTabParamList>();
const LibraryStack = createStackNavigator<LibraryStackParamList>();
const SearchStack = createStackNavigator<SearchStackParamList>();
const AddStack = createStackNavigator<AddStackParamList>();
const MapStack = createStackNavigator<MapStackParamList>();

// ---------------------------------------------------------------------------
// Tab bar components
// ---------------------------------------------------------------------------

/** Animated tab icon with scale and bottom dot indicator. */
function TabIcon({
  name,
  focused,
  color,
}: {
  name: keyof typeof Ionicons.glyphMap;
  focused: boolean;
  color: string;
}) {
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: withSpring(focused ? 1.12 : 1, Animation.spring.crisp),
      },
      {
        translateY: withSpring(focused ? -1 : 0, Animation.spring.crisp),
      },
    ],
  }));

  const dotStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(focused ? 1 : 0, Animation.spring.crisp) }],
    opacity: withTiming(focused ? 1 : 0, { duration: Animation.duration.fast }),
  }));

  return (
    <View style={styles.iconWrapper}>
      <Animated.View style={animatedStyle}>
        <Ionicons name={name} size={22} color={color} />
      </Animated.View>
      <Animated.View style={[styles.activeDot, { backgroundColor: color }, dotStyle]} />
    </View>
  );
}

/** Center Add FAB with idle breathe pulse and press scale. */
function AddTabButton({ onPress }: { onPress?: () => void }) {
  const { isDark, colors } = useTheme();
  const gradientColors = isDark
    ? (['#f28b78', '#e8705a', '#c45a46'] as const)
    : (['#f9a48f', '#f28b78', '#d45a44'] as const);

  const pressed = useSharedValue(0);
  const breathe = useSharedValue(0);

  useEffect(() => {
    breathe.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 1800, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    );
  }, [breathe]);

  const animatedButton = useAnimatedStyle(() => {
    const scale = 1 + breathe.value * 0.04 - pressed.value * 0.12;
    const rotate = pressed.value * 90;
    return {
      transform: [{ scale }, { rotate: `${rotate}deg` }],
    };
  });

  const animatedRing = useAnimatedStyle(() => ({
    opacity: 0.18 + breathe.value * 0.22,
    transform: [{ scale: 1 + breathe.value * 0.18 }],
  }));

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => {
        pressed.value = withSpring(1, Animation.spring.crisp);
      }}
      onPressOut={() => {
        pressed.value = withSpring(0, Animation.spring.snappy);
      }}
      style={styles.addButtonContainer}
    >
      {/* Halo ring — sits behind the FAB to lift it off the bar */}
      <View style={[styles.addButtonHalo, { backgroundColor: colors.background }]} />
      <Animated.View
        pointerEvents="none"
        style={[styles.addButtonGlowRing, { borderColor: colors.accent }, animatedRing]}
      />
      <Animated.View style={animatedButton}>
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.addButton}
        >
          <Ionicons name="add" size={28} color="#ffffff" />
        </LinearGradient>
      </Animated.View>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Stack navigators
// ---------------------------------------------------------------------------

function LibraryStackNavigator() {
  const { colors } = useTheme();
  return (
    <LibraryStack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.background,
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 0,
        },
        headerTintColor: colors.text,
        headerTitleStyle: {
          fontWeight: '700',
          fontSize: 17,
          letterSpacing: -0.4,
        },
        headerBackTitleVisible: false,
        cardStyle: { backgroundColor: colors.background },
        cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
      }}
    >
      <LibraryStack.Screen
        name="LibraryMain"
        component={LibraryScreen}
        options={{ headerShown: false }}
      />
      <LibraryStack.Screen
        name="CategoryDetail"
        component={CategoryDetailScreen}
        options={({ route }: LibraryStackScreenProps<'CategoryDetail'>) => ({
          title: route.params.categoryName,
        })}
      />
      <LibraryStack.Screen
        name="VideoDetail"
        component={VideoDetailScreen}
        options={{ title: '' }}
      />
      <LibraryStack.Screen
        name="FolderDetail"
        component={FolderDetailScreen}
        options={({ route }: LibraryStackScreenProps<'FolderDetail'>) => ({
          title: route.params.folder.name,
        })}
      />
      <LibraryStack.Screen
        name="AddVideo"
        component={AddVideoScreen}
        options={{ title: 'Import' }}
      />
    </LibraryStack.Navigator>
  );
}

function AddStackNavigator() {
  const { colors } = useTheme();
  return (
    <AddStack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.background,
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 0,
        },
        headerTintColor: colors.text,
        headerTitleStyle: {
          fontWeight: '700',
          fontSize: 17,
          letterSpacing: -0.4,
        },
        cardStyle: { backgroundColor: colors.background },
        cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
      }}
    >
      <AddStack.Screen name="AddMain" component={AddVideoScreen} options={{ headerShown: false }} />
    </AddStack.Navigator>
  );
}

function SearchStackNavigator() {
  const { colors } = useTheme();

  return (
    <SearchStack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.background,
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 0,
        },
        headerTintColor: colors.text,
        headerTitleStyle: {
          fontWeight: '700',
          fontSize: 17,
          letterSpacing: -0.4,
        },
        headerBackTitleVisible: false,
        cardStyle: { backgroundColor: colors.background },
        cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
      }}
    >
      <SearchStack.Screen
        name="SearchMain"
        component={SearchScreen}
        options={{ headerShown: false }}
      />
      <SearchStack.Screen
        name="VideoDetail"
        component={VideoDetailScreen}
        options={{ title: '' }}
      />
    </SearchStack.Navigator>
  );
}

function MapStackNavigator() {
  const { colors } = useTheme();
  return (
    <MapStack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.background,
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 0,
        },
        headerTintColor: colors.text,
        headerTitleStyle: {
          fontWeight: '700',
          fontSize: 17,
          letterSpacing: -0.4,
        },
        headerBackTitleVisible: false,
        cardStyle: { backgroundColor: colors.background },
        cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
      }}
    >
      <MapStack.Screen name="MapMain" component={MapScreen} options={{ headerShown: false }} />
      <MapStack.Screen name="VideoDetail" component={VideoDetailScreen} options={{ title: '' }} />
    </MapStack.Navigator>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/** Bottom tab shell: Library, Search, Add, Map, Settings. */
export default function MainNavigator() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      detachInactiveScreens={false}
      sceneContainerStyle={{ flex: 1 }}
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          elevation: 0,
          shadowOpacity: 0,
          paddingTop: 0,
          paddingBottom: 0,
          height: 0,
        },
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.textTertiary,
      }}
      tabBar={(props) => <CustomTabBar {...props} colors={colors} insets={insets} />}
    >
      <Tab.Screen
        name="Library"
        component={LibraryStackNavigator}
        options={{
          tabBarIcon: ({ focused, color }) => (
            <TabIcon name={focused ? 'grid' : 'grid-outline'} focused={focused} color={color} />
          ),
          tabBarLabel: 'Library',
        }}
      />
      <Tab.Screen
        name="Search"
        component={SearchStackNavigator}
        options={{
          tabBarIcon: ({ focused, color }) => (
            <TabIcon name={focused ? 'search' : 'search-outline'} focused={focused} color={color} />
          ),
          tabBarLabel: 'Search',
        }}
      />
      <Tab.Screen
        name="Add"
        component={AddStackNavigator}
        options={{
          tabBarButton: (props: any) => <AddTabButton onPress={props.onPress} />,
          tabBarLabel: '',
        }}
      />
      <Tab.Screen
        name="Map"
        component={MapStackNavigator}
        options={{
          tabBarIcon: ({ focused, color }) => (
            <TabIcon name={focused ? 'map' : 'map-outline'} focused={focused} color={color} />
          ),
          tabBarLabel: 'Map',
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarIcon: ({ focused, color }) => (
            <TabIcon
              name={focused ? 'settings' : 'settings-outline'}
              focused={focused}
              color={color}
            />
          ),
          tabBarLabel: 'Settings',
          headerShown: false,
        }}
      />
    </Tab.Navigator>
  );
}

type TabLayout = { x: number; width: number };

function CustomTabBar({ state, descriptors, navigation, colors, insets }: any) {
  // Track measured layouts of each non-FAB tab so the morphing pill can slide.
  const [layouts, setLayouts] = useState<Record<string, TabLayout>>({});
  const pillX = useSharedValue(0);
  const pillW = useSharedValue(0);
  const pillOpacity = useSharedValue(0);
  const initialised = useRef(false);

  const focusedRoute = state.routes[state.index];
  const focusedKey = focusedRoute?.key;
  const focusedLayout = focusedKey ? layouts[focusedKey] : null;

  useEffect(() => {
    if (!focusedLayout) return;

    if (!initialised.current) {
      // First measurement — snap into place without animating.
      pillX.value = focusedLayout.x;
      pillW.value = focusedLayout.width;
      pillOpacity.value = withTiming(1, { duration: Animation.duration.fast });
      initialised.current = true;
      return;
    }

    pillX.value = withSpring(focusedLayout.x, Animation.spring.crisp);
    pillW.value = withSpring(focusedLayout.width, Animation.spring.crisp);
  }, [focusedLayout, pillX, pillW, pillOpacity]);

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: pillX.value }],
    width: pillW.value,
    opacity: pillOpacity.value,
  }));

  const handleLayout = (key: string) => (event: LayoutChangeEvent) => {
    const { x, width } = event.nativeEvent.layout;
    setLayouts((prev) => {
      const existing = prev[key];
      if (existing && Math.abs(existing.x - x) < 0.5 && Math.abs(existing.width - width) < 0.5) {
        return prev;
      }
      return { ...prev, [key]: { x, width } };
    });
  };

  return (
    <View
      style={[
        styles.tabBarContainer,
        {
          paddingBottom: Platform.OS === 'ios' ? Math.max(insets.bottom, Spacing.lg) : Spacing.lg,
        },
      ]}
    >
      <View
        style={[
          styles.tabBar,
          {
            backgroundColor: colors.glass,
            borderColor: colors.glassBorder,
          },
        ]}
      >
        {/* Shared morphing pill — slides between focused tabs */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.tabPill,
            { backgroundColor: colors.surfaceHover, borderColor: colors.border },
            pillStyle,
          ]}
        />

        {state.routes.map((route: any, index: number) => {
          const { options } = descriptors[route.key];
          const isFocused = state.index === index;
          const label = options.tabBarLabel ?? options.title ?? route.name;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          if (options.tabBarButton) {
            return (
              <View key={route.key} style={styles.centerTab}>
                {options.tabBarButton({ onPress })}
              </View>
            );
          }

          const icon = options.tabBarIcon?.({
            focused: isFocused,
            color: isFocused ? colors.text : colors.textTertiary,
            size: 22,
          });

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              onLayout={handleLayout(route.key)}
              style={styles.tabItem}
            >
              <View style={styles.tabContent}>
                {icon}
                <Text
                  style={[
                    styles.tabLabel,
                    {
                      color: isFocused ? colors.text : colors.textTertiary,
                      fontWeight: isFocused ? '700' : '500',
                    },
                  ]}
                >
                  {label}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  tabBarContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    backgroundColor: 'transparent',
  },
  tabBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderRadius: BorderRadius.xl,
    paddingVertical: 8,
    height: 72,
    borderWidth: 1,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.2,
        shadowRadius: 60,
      },
      android: {
        elevation: 24,
      },
      default: {
        boxShadow: '0 14px 70px rgba(0, 0, 0, 0.22)',
      },
    }),
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    marginHorizontal: 4,
  },
  tabPill: {
    position: 'absolute',
    top: 8,
    bottom: 8,
    left: 0,
    borderRadius: 22,
    borderWidth: 1,
  },
  tabContent: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  tabLabel: {
    fontSize: 10,
    letterSpacing: 0.3,
  },
  iconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 26,
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 3,
  },
  centerTab: {
    flex: 1,
    position: 'relative',
  },
  addButtonContainer: {
    position: 'absolute',
    top: -30,
    left: '50%',
    transform: [{ translateX: -32 }],
    alignItems: 'center',
    justifyContent: 'center',
    width: 64,
    height: 64,
  },
  addButtonHalo: {
    position: 'absolute',
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  addButtonGlowRing: {
    position: 'absolute',
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1.5,
  },
  addButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.glow,
  },
});
