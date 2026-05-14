import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator, CardStyleInterpolators } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { View, StyleSheet, Platform, Pressable, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useAnimatedStyle, withSpring, interpolateColor } from 'react-native-reanimated';

import { MainTabParamList, LibraryStackParamList, SearchStackParamList, AddStackParamList, MapStackParamList, LibraryStackScreenProps } from './types';
import { Spacing, BorderRadius, Shadows } from '../config';
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

const Tab = createBottomTabNavigator<MainTabParamList>();
const LibraryStack = createStackNavigator<LibraryStackParamList>();
const SearchStack = createStackNavigator<SearchStackParamList>();
const AddStack = createStackNavigator<AddStackParamList>();
const MapStack = createStackNavigator<MapStackParamList>();

// Animated Tab Icon
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
    transform: [{ scale: withSpring(focused ? 1.1 : 1, { damping: 15, stiffness: 300 }) }],
  }));

  return (
    <View style={styles.iconWrapper}>
      <Animated.View style={animatedStyle}>
        <Ionicons name={name} size={22} color={color} />
      </Animated.View>
      {focused && (
        <View style={[styles.activeDot, { backgroundColor: color }]} />
      )}
    </View>
  );
}

// Center Add Button
function AddTabButton({ onPress }: { onPress?: () => void }) {
  const { isDark } = useTheme();
  const gradientColors = isDark
    ? ['#e8705a', '#c45a46'] as const
    : ['#f28b78', '#d45a44'] as const;

  return (
    <Pressable onPress={onPress} style={styles.addButtonContainer}>
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.addButton}
      >
        <Ionicons name="add" size={28} color="#ffffff" />
      </LinearGradient>
    </Pressable>
  );
}

// Stack navigators
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
      <AddStack.Screen
        name="AddMain"
        component={AddVideoScreen}
        options={{ headerShown: false }}
      />
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
      <MapStack.Screen
        name="MapMain"
        component={MapScreen}
        options={{ headerShown: false }}
      />
      <MapStack.Screen
        name="VideoDetail"
        component={VideoDetailScreen}
        options={{ title: '' }}
      />
    </MapStack.Navigator>
  );
}

export default function MainNavigator() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
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
            <TabIcon name={focused ? 'settings' : 'settings-outline'} focused={focused} color={color} />
          ),
          tabBarLabel: 'Settings',
          headerShown: false,
        }}
      />
    </Tab.Navigator>
  );
}

function CustomTabBar({
  state,
  descriptors,
  navigation,
  colors,
  insets,
}: any) {
  return (
    <View
      style={[
        styles.tabBarContainer,
        {
          paddingBottom: Platform.OS === 'ios' ? Math.max(insets.bottom, 12) : 12,
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

const styles = StyleSheet.create({
  tabBarContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.md,
    paddingTop: 8,
    backgroundColor: 'transparent',
  },
  tabBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderRadius: BorderRadius.xl,
    paddingVertical: 6,
    height: 68,
    overflow: 'hidden',
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
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -28,
  },
  addButtonContainer: {
    alignItems: 'center',
    justifyContent: 'center',
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
