/**
 * Database row and API response types aligned with PostgreSQL schemas.
 */

// --- types ---

/** Users table row. */
export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  display_name: string | null;
  avatar_url: string | null;
  settings: UserSettings;
  created_at: Date;
  updated_at: Date;
}

export interface UserSettings {
  enableVideoUpload?: boolean;
  autoFileHighConfidence?: boolean;
  notificationsEnabled?: boolean;
  confidenceThreshold?: number;
  defaultInboxRetention?: number;
  theme?: 'light' | 'dark' | 'system';
}

// Folders table row
export interface FolderRow {
  id: string;
  user_id: string;
  name: string;
  parent_id: string | null;
  icon_name: string | null;
  color_hex: string | null;
  sort_order: number;
  is_default: boolean;
  rules: FolderRules | null;
  created_at: Date;
  updated_at: Date;
  // Virtual columns from JOINs
  item_count?: string;
  parent_name?: string;
  weights?: UserPreferenceWeights;
}

export interface FolderRules {
  creators?: string[];
  topics?: string[];
  labels?: string[];
  hashtags?: string[];
}

// Save items table row
export interface SaveItemRow {
  id: string;
  user_id: string;
  source_url: string;
  raw_shared_text: string | null;
  status: SaveItemStatus;
  video_blob_name: string | null;
  thumbnail_url: string | null;
  transcript_text: string | null;
  detected_topics: string[];
  detected_labels: string[];
  predicted_folder_id: string | null;
  confidence: string | null; // DECIMAL comes as string from pg
  folder_id: string | null;
  title: string | null;
  duration: string | null; // DECIMAL comes as string from pg
  creator_name: string | null;
  creator_username: string | null;
  video_indexer_id: string | null;
  insights_json: Record<string, unknown> | null;
  error_message: string | null;
  embedding: number[] | null;
  latitude: string | null; // DECIMAL comes as string from pg
  longitude: string | null; // DECIMAL comes as string from pg
  location_name: string | null;
  address: string | null;
  created_at: Date;
  updated_at: Date;
  // Virtual columns from JOINs
  folder_name?: string;
  // Map-specific virtual columns
  location_id?: string;
  sil_latitude?: string;
  sil_longitude?: string;
  sil_location_name?: string;
  sil_address?: string;
}

export type SaveItemStatus =
  | 'queued'
  | 'upload_requested'
  | 'uploading'
  | 'processing'
  | 'ready'
  | 'needs_review'
  | 'failed';

// Save item locations table row
export interface SaveItemLocationRow {
  id: string;
  item_id: string;
  latitude: string; // DECIMAL comes as string from pg
  longitude: string; // DECIMAL comes as string from pg
  location_name: string | null;
  address: string | null;
  created_at: Date;
  updated_at: Date;
}

// Training examples table row
export interface TrainingExampleRow {
  id: string;
  user_id: string;
  item_id: string;
  original_folder_id: string | null;
  corrected_folder_id: string;
  features: TrainingFeatures;
  created_at: Date;
}

export interface TrainingFeatures {
  topics: string[];
  labels: string[];
  transcriptKeywords: string[];
  hashtags: string[];
  creatorUsername?: string;
}

// User preferences table row
export interface UserPreferenceRow {
  id: string;
  user_id: string;
  folder_id: string;
  weights: UserPreferenceWeights;
  updated_at: Date;
}

export interface UserPreferenceWeights {
  topicWeights?: Record<string, number>;
  labelWeights?: Record<string, number>;
  creatorWeights?: Record<string, number>;
  keywordWeights?: Record<string, number>;
  folderBias?: number;
}

// API response types (formatted from database rows)
export interface FormattedUser {
  id: string;
  email: string;
  displayName: string | null;
  avatarURL: string | null;
  createdAt: Date;
  settings: UserSettings;
}

export interface FormattedFolder {
  id: string;
  name: string;
  parentId: string | null;
  iconName: string | null;
  colorHex: string | null;
  sortOrder: number;
  isDefault: boolean;
  rules: FolderRules | null;
  itemCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface FormattedSaveItem {
  id: string;
  sourceURL: string;
  dateAdded: Date;
  rawSharedText: string | null;
  status: SaveItemStatus;
  thumbnailURL: string | null;
  transcriptText: string | null;
  detectedTopics: string[];
  detectedLabels: string[];
  predictedFolderId: string | null;
  confidence: number | undefined;
  folderId: string | null;
  folderName: string | null;
  title: string | null;
  duration: number | null;
  creatorName: string | null;
  creatorUsername: string | null;
  errorMessage: string | null;
  latitude: number | null;
  longitude: number | null;
  locationName: string | null;
  address: string | null;
  // Map-specific fields
  locationId?: string;
  similarity?: number;
}

// Query result helper type
export interface QueryResult<T> {
  rows: T[];
  rowCount: number;
}
