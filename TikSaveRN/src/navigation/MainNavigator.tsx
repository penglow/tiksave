/**
 * Main tab navigator with custom floating tab bar, nested stacks, and animated Add FAB.
 */

import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator, CardStyleInterpolators } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { View, StyleSheet, Platform, Pressable, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';

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

/** Tab icon with dark circular active state (mockup style). */
function TabIcon({
  name,
  focused,
  inactiveColor,
  activeBg,
  activeIconColor,
}: {
  name: keyof typeof Ionicons.glyphMap;
  focused: boolean;
  inactiveColor: string;
  activeBg: string;
  activeIconColor: string;
}) {
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(focused ? 1.05 : 1, Animation.spring.crisp) }],
  }));

  return (
    <Animated.View
      style={[
        styles.tabIconBubble,
        focused && { backgroundColor: activeBg },
        animatedStyle,
      ]}
    >
      <Ionicons name={name} size={22} color={focused ? activeIconColor : inactiveColor} />
    </Animated.View>
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

/** Bottom tab shell: Library, Import, Search, Map, Settings. */
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
          tabBarIcon: ({ focused }) => (
            <TabIcon
              name={focused ? 'albums' : 'albums-outline'}
              focused={focused}
              inactiveColor={colors.textTertiary}
              activeBg={colors.tabActive}
              activeIconColor={colors.tabActiveIcon}
            />
          ),
          tabBarLabel: 'Library',
        }}
      />
      <Tab.Screen
        name="Add"
        component={AddStackNavigator}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon
              name={focused ? 'download' : 'download-outline'}
              focused={focused}
              inactiveColor={colors.textTertiary}
              activeBg={colors.tabActive}
              activeIconColor={colors.tabActiveIcon}
            />
          ),
          tabBarLabel: 'Import',
        }}
      />
      <Tab.Screen
        name="Search"
        component={SearchStackNavigator}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon
              name={focused ? 'search' : 'search-outline'}
              focused={focused}
              inactiveColor={colors.textTertiary}
              activeBg={colors.tabActive}
              activeIconColor={colors.tabActiveIcon}
            />
          ),
          tabBarLabel: 'Search',
        }}
      />
      <Tab.Screen
        name="Map"
        component={MapStackNavigator}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon
              name={focused ? 'map' : 'map-outline'}
              focused={focused}
              inactiveColor={colors.textTertiary}
              activeBg={colors.tabActive}
              activeIconColor={colors.tabActiveIcon}
            />
          ),
          tabBarLabel: 'Map',
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon
              name={focused ? 'settings' : 'settings-outline'}
              focused={focused}
              inactiveColor={colors.textTertiary}
              activeBg={colors.tabActive}
              activeIconColor={colors.tabActiveIcon}
            />
          ),
          tabBarLabel: 'Settings',
          headerShown: false,
        }}
      />
    </Tab.Navigator>
  );
}

function CustomTabBar({ state, descriptors, navigation, colors, insets }: any) {
  const { isDark } = useTheme();

  return (
    <View
      style={[
        styles.tabBarContainer,
        {
          paddingBottom: Platform.OS === 'ios' ? Math.max(insets.bottom, Spacing.md) : Spacing.lg,
        },
      ]}
    >
      <View style={[styles.tabBarOuter, Shadows.glass]}>
        {Platform.OS !== 'android' && Platform.OS !== 'web' && (
          <BlurView
            intensity={55}
            tint={isDark ? 'dark' : 'light'}
            style={[StyleSheet.absoluteFill, { borderRadius: BorderRadius.xl }]}
          />
        )}
        <View
          style={[
            styles.tabBar,
            {
              backgroundColor:
                Platform.OS === 'android' || Platform.OS === 'web'
                  ? colors.glassStrong
                  : 'transparent',
              borderColor: colors.glassBorder,
            },
          ]}
        >
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

            const icon = options.tabBarIcon?.({
              focused: isFocused,
              color: isFocused ? colors.tabActiveIcon : colors.textTertiary,
              size: 22,
            });

            return (
              <Pressable key={route.key} onPress={onPress} style={styles.tabItem}>
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
    paddingTop: Spacing.sm,
    backgroundColor: 'transparent',
  },
  tabBarOuter: {
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
  },
  tabBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderRadius: BorderRadius.xl,
    paddingVertical: 10,
    paddingHorizontal: 4,
    minHeight: 68,
    borderWidth: 1,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabContent: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  tabLabel: {
    fontSize: 10,
    letterSpacing: 0.2,
  },
  tabIconBubble: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
