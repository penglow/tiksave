import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { View, Text, StyleSheet } from 'react-native';

import { MainTabParamList, FoldersStackParamList, InboxStackParamList, SearchStackParamList } from './types';
import { Colors } from '../config';
import { useAppStore } from '../stores/appStore';

// Screens
import InboxScreen from '../screens/InboxScreen';
import FoldersScreen from '../screens/FoldersScreen';
import FolderDetailScreen from '../screens/FolderDetailScreen';
import SearchScreen from '../screens/SearchScreen';
import SettingsScreen from '../screens/SettingsScreen';
import VideoDetailScreen from '../screens/VideoDetailScreen';

const Tab = createBottomTabNavigator<MainTabParamList>();
const InboxStack = createNativeStackNavigator<InboxStackParamList>();
const FoldersStack = createNativeStackNavigator<FoldersStackParamList>();
const SearchStack = createNativeStackNavigator<SearchStackParamList>();

// Stack navigators for each tab
function InboxStackNavigator() {
  return (
    <InboxStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: Colors.background },
        headerTintColor: Colors.text,
        headerTitleStyle: { fontWeight: '600' },
        contentStyle: { backgroundColor: Colors.background },
      }}
    >
      <InboxStack.Screen 
        name="InboxMain" 
        component={InboxScreen}
        options={{ title: 'Inbox', headerLargeTitle: true }}
      />
      <InboxStack.Screen 
        name="VideoDetail" 
        component={VideoDetailScreen}
        options={{ title: 'Video Details' }}
      />
    </InboxStack.Navigator>
  );
}

function FoldersStackNavigator() {
  return (
    <FoldersStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: Colors.background },
        headerTintColor: Colors.text,
        headerTitleStyle: { fontWeight: '600' },
        contentStyle: { backgroundColor: Colors.background },
      }}
    >
      <FoldersStack.Screen 
        name="FoldersList" 
        component={FoldersScreen}
        options={{ title: 'Folders', headerLargeTitle: true }}
      />
      <FoldersStack.Screen 
        name="FolderDetail" 
        component={FolderDetailScreen}
        options={({ route }) => ({ title: route.params.folder.name })}
      />
      <FoldersStack.Screen 
        name="VideoDetail" 
        component={VideoDetailScreen}
        options={{ title: 'Video Details' }}
      />
    </FoldersStack.Navigator>
  );
}

function SearchStackNavigator() {
  return (
    <SearchStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: Colors.background },
        headerTintColor: Colors.text,
        headerTitleStyle: { fontWeight: '600' },
        contentStyle: { backgroundColor: Colors.background },
      }}
    >
      <SearchStack.Screen 
        name="SearchMain" 
        component={SearchScreen}
        options={{ title: 'Search', headerLargeTitle: true }}
      />
      <SearchStack.Screen 
        name="VideoDetail" 
        component={VideoDetailScreen}
        options={{ title: 'Video Details' }}
      />
    </SearchStack.Navigator>
  );
}

// Badge component for inbox tab
function TabBadge({ count }: { count: number }) {
  if (count === 0) return null;
  
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{count > 99 ? '99+' : count}</Text>
    </View>
  );
}

export default function MainNavigator() {
  const unreadInboxCount = useAppStore((state) => state.unreadInboxCount);

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
        name="Inbox"
        component={InboxStackNavigator}
        options={{
          tabBarIcon: ({ focused, color, size }) => (
            <View>
              <Ionicons 
                name={focused ? 'file-tray-full' : 'file-tray-full-outline'} 
                size={size} 
                color={color} 
              />
              <TabBadge count={unreadInboxCount} />
            </View>
          ),
        }}
      />
      <Tab.Screen
        name="Folders"
        component={FoldersStackNavigator}
        options={{
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons 
              name={focused ? 'folder' : 'folder-outline'} 
              size={size} 
              color={color} 
            />
          ),
        }}
      />
      <Tab.Screen
        name="Search"
        component={SearchStackNavigator}
        options={{
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons 
              name={focused ? 'search' : 'search-outline'} 
              size={size} 
              color={color} 
            />
          ),
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons 
              name={focused ? 'settings' : 'settings-outline'} 
              size={size} 
              color={color} 
            />
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
  badge: {
    position: 'absolute',
    right: -10,
    top: -4,
    backgroundColor: Colors.error,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: Colors.text,
    fontSize: 10,
    fontWeight: '700',
  },
});

