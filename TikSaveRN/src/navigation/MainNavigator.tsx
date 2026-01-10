import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { View, StyleSheet } from 'react-native';

import { MainTabParamList, LibraryStackParamList, SearchStackParamList, AddStackParamList } from './types';
import { Colors } from '../config';

// Screens
import LibraryScreen from '../screens/LibraryScreen';
import CategoryDetailScreen from '../screens/CategoryDetailScreen';
import AddVideoScreen from '../screens/AddVideoScreen';
import SearchScreen from '../screens/SearchScreen';
import SettingsScreen from '../screens/SettingsScreen';
import VideoDetailScreen from '../screens/VideoDetailScreen';

const Tab = createBottomTabNavigator<MainTabParamList>();
const LibraryStack = createStackNavigator<LibraryStackParamList>();
const SearchStack = createStackNavigator<SearchStackParamList>();
const AddStack = createStackNavigator<AddStackParamList>();

// Stack navigators for each tab
function LibraryStackNavigator() {
  return (
    <LibraryStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: Colors.background },
        headerTintColor: Colors.text,
        headerTitleStyle: { fontWeight: '600' },
        cardStyle: { backgroundColor: Colors.background },
      }}
    >
      <LibraryStack.Screen 
        name="LibraryMain" 
        component={LibraryScreen}
        options={{ title: 'My Library' }}
      />
      <LibraryStack.Screen 
        name="CategoryDetail" 
        component={CategoryDetailScreen}
        options={({ route }) => ({ title: route.params.categoryName })}
      />
      <LibraryStack.Screen 
        name="VideoDetail" 
        component={VideoDetailScreen}
        options={{ title: 'Video Details' }}
      />
      <LibraryStack.Screen 
        name="AddVideo" 
        component={AddVideoScreen}
        options={{ title: 'Import TikTok' }}
      />
    </LibraryStack.Navigator>
  );
}

function AddStackNavigator() {
  return (
    <AddStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: Colors.background },
        headerTintColor: Colors.text,
        headerTitleStyle: { fontWeight: '600' },
        cardStyle: { backgroundColor: Colors.background },
      }}
    >
      <AddStack.Screen 
        name="AddMain" 
        component={AddVideoScreen}
        options={{ title: 'Import TikTok' }}
      />
    </AddStack.Navigator>
  );
}

function SearchStackNavigator() {
  return (
    <SearchStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: Colors.background },
        headerTintColor: Colors.text,
        headerTitleStyle: { fontWeight: '600' },
        cardStyle: { backgroundColor: Colors.background },
      }}
    >
      <SearchStack.Screen 
        name="SearchMain" 
        component={SearchScreen}
        options={{ title: 'Search' }}
      />
      <SearchStack.Screen 
        name="VideoDetail" 
        component={VideoDetailScreen}
        options={{ title: 'Video Details' }}
      />
    </SearchStack.Navigator>
  );
}


export default function MainNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors.background,
          borderTopColor: Colors.border,
          borderTopWidth: 1,
          paddingTop: 8,
          paddingBottom: 8,
          height: 88,
        },
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textTertiary,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
          marginTop: 4,
        },
      }}
    >
      <Tab.Screen
        name="Library"
        component={LibraryStackNavigator}
        options={{
          tabBarIcon: ({ focused, color, size }) => (
            <View style={styles.iconContainer}>
              <Ionicons 
                name={focused ? 'grid' : 'grid-outline'} 
                size={size} 
                color={color} 
              />
              {focused && <View style={[styles.activeIndicator, { backgroundColor: Colors.primary }]} />}
            </View>
          ),
          tabBarLabel: 'Library',
        }}
      />
      <Tab.Screen
        name="Add"
        component={AddStackNavigator}
        options={{
          tabBarIcon: ({ focused, color, size }) => (
            <View style={styles.iconContainer}>
              <Ionicons 
                name={focused ? 'add-circle' : 'add-circle-outline'} 
                size={size} 
                color={color} 
              />
              {focused && <View style={[styles.activeIndicator, { backgroundColor: Colors.primary }]} />}
            </View>
          ),
          tabBarLabel: 'Import',
        }}
      />
      <Tab.Screen
        name="Search"
        component={SearchStackNavigator}
        options={{
          tabBarIcon: ({ focused, color, size }) => (
            <View style={styles.iconContainer}>
              <Ionicons 
                name={focused ? 'search' : 'search-outline'} 
                size={size} 
                color={color} 
              />
              {focused && <View style={[styles.activeIndicator, { backgroundColor: Colors.primary }]} />}
            </View>
          ),
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarIcon: ({ focused, color, size }) => (
            <View style={styles.iconContainer}>
              <Ionicons 
                name={focused ? 'settings' : 'settings-outline'} 
                size={size} 
                color={color} 
              />
              {focused && <View style={[styles.activeIndicator, { backgroundColor: Colors.primary }]} />}
            </View>
          ),
          headerShown: true,
          headerStyle: { backgroundColor: Colors.background },
          headerTintColor: Colors.text,
          headerTitleStyle: { fontWeight: '600' },
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  iconContainer: {
    alignItems: 'center',
  },
  activeIndicator: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 4,
  },
});
