/**
 * React Navigation param lists and typed screen props for all app navigators.
 */

import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { CompositeScreenProps, NavigatorScreenParams } from '@react-navigation/native';
import { Folder, SaveItem } from '../types';

// ---------------------------------------------------------------------------
// Root stack
// ---------------------------------------------------------------------------

export type RootStackParamList = {
  Auth: undefined;
  Main: NavigatorScreenParams<MainTabParamList>;
};

export type RootStackScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  T
>;

// ---------------------------------------------------------------------------
// Main tabs
// ---------------------------------------------------------------------------

export type MainTabParamList = {
  Library: undefined;
  Add: undefined;
  Search: undefined;
  Map: undefined;
  Settings: undefined;
};

export type MainTabScreenProps<T extends keyof MainTabParamList> = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, T>,
  RootStackScreenProps<keyof RootStackParamList>
>;

// ---------------------------------------------------------------------------
// Library stack
// ---------------------------------------------------------------------------

export type LibraryStackParamList = {
  LibraryMain: undefined;
  CategoryDetail: { categoryName: string; icon: string; color: string; subcategoryName?: string };
  VideoDetail: { item: SaveItem };
  FolderDetail: { folder: Folder };
  AddVideo: undefined;
};

export type LibraryStackScreenProps<T extends keyof LibraryStackParamList> = NativeStackScreenProps<
  LibraryStackParamList,
  T
>;

// ---------------------------------------------------------------------------
// Folders stack
// ---------------------------------------------------------------------------

export type FoldersStackParamList = {
  FoldersList: undefined;
  FolderDetail: { folder: Folder };
  VideoDetail: { item: SaveItem };
};

export type FoldersStackScreenProps<T extends keyof FoldersStackParamList> = NativeStackScreenProps<
  FoldersStackParamList,
  T
>;

// ---------------------------------------------------------------------------
// Search stack
// ---------------------------------------------------------------------------

export type SearchStackParamList = {
  SearchMain: undefined;
  VideoDetail: { item: SaveItem };
};

export type SearchStackScreenProps<T extends keyof SearchStackParamList> = NativeStackScreenProps<
  SearchStackParamList,
  T
>;

// ---------------------------------------------------------------------------
// Inbox stack
// ---------------------------------------------------------------------------

export type InboxStackParamList = {
  InboxMain: undefined;
  VideoDetail: { item: SaveItem };
};

export type InboxStackScreenProps<T extends keyof InboxStackParamList> = NativeStackScreenProps<
  InboxStackParamList,
  T
>;

// ---------------------------------------------------------------------------
// Add stack
// ---------------------------------------------------------------------------

export type AddStackParamList = {
  AddMain: undefined;
};

export type AddStackScreenProps<T extends keyof AddStackParamList> = NativeStackScreenProps<
  AddStackParamList,
  T
>;

// ---------------------------------------------------------------------------
// Map stack
// ---------------------------------------------------------------------------

export type MapStackParamList = {
  MapMain: undefined;
  VideoDetail: { item: SaveItem };
};

export type MapStackScreenProps<T extends keyof MapStackParamList> = NativeStackScreenProps<
  MapStackParamList,
  T
>;

// ---------------------------------------------------------------------------
// Global augmentation
// ---------------------------------------------------------------------------

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList { }
  }
}
