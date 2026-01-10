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
  Library: undefined;
  Add: undefined;
  Search: undefined;
  Settings: undefined;
};

export type MainTabScreenProps<T extends keyof MainTabParamList> = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, T>,
  RootStackScreenProps<keyof RootStackParamList>
>;

// Library Stack Navigator (main view with AI categories)
export type LibraryStackParamList = {
  LibraryMain: undefined;
  CategoryDetail: { categoryName: string; icon: string; color: string };
  VideoDetail: { item: SaveItem };
  AddVideo: undefined;
};

export type LibraryStackScreenProps<T extends keyof LibraryStackParamList> = NativeStackScreenProps<
  LibraryStackParamList,
  T
>;

// Folders Stack Navigator (optional manual organization)
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

// Inbox Stack Navigator (for processing/review items)
export type InboxStackParamList = {
  InboxMain: undefined;
  VideoDetail: { item: SaveItem };
};

export type InboxStackScreenProps<T extends keyof InboxStackParamList> = NativeStackScreenProps<
  InboxStackParamList,
  T
>;

// Add Stack Navigator
export type AddStackParamList = {
  AddMain: undefined;
};

export type AddStackScreenProps<T extends keyof AddStackParamList> = NativeStackScreenProps<
  AddStackParamList,
  T
>;

// Declare global navigation types
declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
