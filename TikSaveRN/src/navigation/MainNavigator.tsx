import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator, CardStyleInterpolators } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { View, StyleSheet, Platform } from 'react-native';
import Animated from 'react-native-reanimated';

import { MainTabParamList, LibraryStackParamList, SearchStackParamList, AddStackParamList, MapStackParamList, LibraryStackScreenProps } from './types';
import { Spacing, BorderRadius } from '../config';
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

// Animated Tab Icon Component
function TabIcon({
  name,
  focused,
  color
}: {
  name: keyof typeof Ionicons.glyphMap;
  focused: boolean;
  color: string;
}) {
  return (
    <Animated.View
      style={[
        styles.iconWrapper,
        {
          opacity: focused ? 1 : 0.6,
          transform: [{ scale: focused ? 1.05 : 1 }],
        }
      ]}
    >
      <Ionicons name={name} size={22} color={color} />
    </Animated.View>
  );
}


// Stack navigators for each tab
function LibraryStackNavigator() {
  const { colors: themeColors } = useTheme();
  return (
    <LibraryStack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: themeColors.background,
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 0,
        },
        headerTintColor: themeColors.text,
        headerTitleStyle: {
          fontWeight: '600',
          fontSize: 17,
          letterSpacing: -0.4,
        },
        headerBackTitleVisible: false,
        cardStyle: { backgroundColor: themeColors.background },
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
          title: route.params.folder.name
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
  const { colors: themeColors } = useTheme();
  return (
    <AddStack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: themeColors.background,
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 0,
        },
        headerTintColor: themeColors.text,
        headerTitleStyle: {
          fontWeight: '600',
          fontSize: 17,
          letterSpacing: -0.4,
        },
        cardStyle: { backgroundColor: themeColors.background },
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
  const { colors: themeColors } = useTheme();
  return (
    <SearchStack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: themeColors.background,
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 0,
        },
        headerTintColor: themeColors.text,
        headerTitleStyle: {
          fontWeight: '600',
          fontSize: 17,
          letterSpacing: -0.4,
        },
        headerBackTitleVisible: false,
        cardStyle: { backgroundColor: themeColors.background },
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
  const { colors: themeColors } = useTheme();
  return (
    <MapStack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: themeColors.background,
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 0,
        },
        headerTintColor: themeColors.text,
        headerTitleStyle: {
          fontWeight: '600',
          fontSize: 17,
          letterSpacing: -0.4,
        },
        headerBackTitleVisible: false,
        cardStyle: { backgroundColor: themeColors.background },
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
  const { colors: themeColors } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: themeColors.background,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: themeColors.border,
          paddingTop: Spacing.sm,
          paddingBottom: Platform.OS === 'ios' ? 24 : 12,
          height: Platform.OS === 'ios' ? 64 : 56,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarActiveTintColor: themeColors.text,
        tabBarInactiveTintColor: themeColors.textTertiary,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '500',
          letterSpacing: 0.2,
          marginTop: 2,
        },
        tabBarItemStyle: {
          paddingTop: 2,
        },
      }}
    >
      <Tab.Screen
        name="Library"
        component={LibraryStackNavigator}
        options={{
          tabBarIcon: ({ focused, color }) => (
            <TabIcon
              name={focused ? 'grid' : 'grid-outline'}
              focused={focused}
              color={color}
            />
          ),
          tabBarLabel: 'Library',
        }}
      />
      <Tab.Screen
        name="Add"
        component={AddStackNavigator}
        options={{
          tabBarIcon: ({ focused, color }) => (
            <TabIcon
              name={focused ? 'add-circle' : 'add-circle-outline'}
              focused={focused}
              color={color}
            />
          ),
          tabBarLabel: 'Import',
        }}
      />
      <Tab.Screen
        name="Search"
        component={SearchStackNavigator}
        options={{
          tabBarIcon: ({ focused, color }) => (
            <TabIcon
              name={focused ? 'search' : 'search-outline'}
              focused={focused}
              color={color}
            />
          ),
          tabBarLabel: 'Search',
        }}
      />
      <Tab.Screen
        name="Map"
        component={MapStackNavigator}
        options={{
          tabBarIcon: ({ focused, color }) => (
            <TabIcon
              name={focused ? 'map' : 'map-outline'}
              focused={focused}
              color={color}
            />
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

const styles = StyleSheet.create({
  iconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
