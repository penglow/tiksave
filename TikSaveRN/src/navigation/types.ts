import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { CompositeScreenProps, NavigatorScreenParams } from '@react-navigation/native';
import { Folder, SaveItem } from '../types';

// Root Stack Navigator
export type RootStackParamList = {
  Auth: undefined;
  Main: NavigatorScreenParams<MainTabParamList>;
};

export type RootStackScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  T
>;

// Main Tab Navigator
export type MainTabParamList = {
  Inbox: undefined;
  Folders: undefined;
  Search: undefined;
  Settings: undefined;
};

export type MainTabScreenProps<T extends keyof MainTabParamList> = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, T>,
  RootStackScreenProps<keyof RootStackParamList>
>;

// Folders Stack Navigator
export type FoldersStackParamList = {
  FoldersList: undefined;
  FolderDetail: { folder: Folder };
  VideoDetail: { item: SaveItem };
};

export type FoldersStackScreenProps<T extends keyof FoldersStackParamList> = NativeStackScreenProps<
  FoldersStackParamList,
  T
>;

// Search Stack Navigator
export type SearchStackParamList = {
  SearchMain: undefined;
  VideoDetail: { item: SaveItem };
};

export type SearchStackScreenProps<T extends keyof SearchStackParamList> = NativeStackScreenProps<
  SearchStackParamList,
  T
>;

// Inbox Stack Navigator
export type InboxStackParamList = {
  InboxMain: undefined;
  VideoDetail: { item: SaveItem };
};

export type InboxStackScreenProps<T extends keyof InboxStackParamList> = NativeStackScreenProps<
  InboxStackParamList,
  T
>;

// Declare global navigation types
declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}

