// Save Item Status
export type SaveItemStatus =
  | 'queued'
  | 'upload_requested'
  | 'uploading'
  | 'processing'
  | 'ready'
  | 'needs_review'
  | 'failed';

export const STATUS_DISPLAY_NAMES: Record<SaveItemStatus, string> = {
  queued: 'Queued',
  upload_requested: 'Preparing Upload',
  uploading: 'Uploading',
  processing: 'Processing',
  ready: 'Ready',
  needs_review: 'Needs Review',
  failed: 'Failed',
};

export const isLoadingStatus = (status: SaveItemStatus): boolean => {
  return ['queued', 'upload_requested', 'uploading', 'processing'].includes(status);
};

// Save Item Model
export interface SaveItem {
  id: string;
  sourceURL: string;
  dateAdded: string;
  rawSharedText?: string;
  status: SaveItemStatus;
  thumbnailURL?: string;
  transcriptText?: string;
  detectedTopics: string[];
  detectedLabels: string[];
  predictedFolderId?: string;
  confidence?: number;
  folderId?: string;
  folderName?: string;
  title?: string;
  duration?: number;
  creatorName?: string;
  creatorUsername?: string;
  errorMessage?: string;
}

// Helper functions for SaveItem
export const getDisplayTitle = (item: SaveItem): string => {
  if (item.title && item.title.length > 0) {
    return item.title;
  }
  if (item.transcriptText && item.transcriptText.length > 0) {
    const words = item.transcriptText.split(' ').slice(0, 10);
    const truncated = words.join(' ');
    return item.transcriptText.split(' ').length > 10 ? `${truncated}...` : truncated;
  }
  return 'TikTok Video';
};

export const needsUserReview = (item: SaveItem, mediumConfidenceThreshold = 0.6): boolean => {
  return item.status === 'needs_review' || (item.confidence ?? 0) < mediumConfidenceThreshold;
};

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export const getConfidenceLevel = (
  confidence: number | undefined,
  highThreshold = 0.85,
  mediumThreshold = 0.6
): ConfidenceLevel => {
  if (!confidence) return 'low';
  if (confidence >= highThreshold) return 'high';
  if (confidence >= mediumThreshold) return 'medium';
  return 'low';
};

export const CONFIDENCE_COLORS: Record<ConfidenceLevel, string> = {
  high: '#22C55E',
  medium: '#F97316',
  low: '#EF4444',
};

// Folder Rule
export type RuleField = 'topic' | 'label' | 'transcript' | 'hashtag' | 'creator';
export type RuleOperation = 'contains' | 'equals' | 'startsWith' | 'matches';

export interface FolderRule {
  id: string;
  field: RuleField;
  operation: RuleOperation;
  value: string;
  weight: number;
}

// Folder Model
export interface Folder {
  id: string;
  name: string;
  parentId?: string;
  iconName?: string;
  colorHex?: string;
  sortOrder: number;
  isDefault: boolean;
  rules?: FolderRule[];
  itemCount: number;
  createdAt: string;
  updatedAt: string;
}

// Folder Node (for tree display)
export interface FolderNode {
  folder: Folder;
  children: FolderNode[];
}

// Get display icon for folder
export const getDisplayIcon = (folder: Folder): string => {
  if (folder.iconName) return folder.iconName;
  return getDefaultIconForName(folder.name);
};

const getDefaultIconForName = (name: string): string => {
  const lowercased = name.toLowerCase();

  // Travel destinations
  if (lowercased.includes('japan')) return '🇯🇵';
  if (lowercased.includes('korea')) return '🇰🇷';
  if (lowercased.includes('china')) return '🇨🇳';
  if (lowercased.includes('usa') || lowercased.includes('america')) return '🇺🇸';
  if (lowercased.includes('uk') || lowercased.includes('britain')) return '🇬🇧';
  if (lowercased.includes('france')) return '🇫🇷';
  if (lowercased.includes('italy')) return '🇮🇹';
  if (lowercased.includes('spain')) return '🇪🇸';
  if (lowercased.includes('germany')) return '🇩🇪';
  if (lowercased.includes('thailand')) return '🇹🇭';
  if (lowercased.includes('vietnam')) return '🇻🇳';

  // Categories
  if (lowercased.includes('food') || lowercased.includes('recipe')) return '🍽️';
  if (lowercased.includes('hotel') || lowercased.includes('stay')) return '🏨';
  if (lowercased.includes('attraction') || lowercased.includes('sightseeing')) return '🎡';
  if (lowercased.includes('shopping') || lowercased.includes('haul')) return '🛍️';
  if (lowercased.includes('gym') || lowercased.includes('fitness') || lowercased.includes('workout')) return '💪';
  if (lowercased.includes('car') || lowercased.includes('auto')) return '🚗';
  if (lowercased.includes('finance') || lowercased.includes('money') || lowercased.includes('invest')) return '💰';
  if (lowercased.includes('tech') || lowercased.includes('gadget')) return '📱';
  if (lowercased.includes('fashion') || lowercased.includes('style') || lowercased.includes('outfit')) return '👗';
  if (lowercased.includes('beauty') || lowercased.includes('makeup') || lowercased.includes('skincare')) return '💄';
  if (lowercased.includes('pet') || lowercased.includes('dog') || lowercased.includes('cat')) return '🐾';
  if (lowercased.includes('diy') || lowercased.includes('craft')) return '🔨';
  if (lowercased.includes('music')) return '🎵';
  if (lowercased.includes('dance')) return '💃';
  if (lowercased.includes('comedy') || lowercased.includes('funny')) return '😂';
  if (lowercased.includes('education') || lowercased.includes('learn')) return '📚';

  return '📁';
};

// User Settings
export type AppTheme = 'light' | 'dark' | 'system';

export interface UserSettings {
  enableVideoUpload: boolean;
  autoFileHighConfidence: boolean;
  notificationsEnabled: boolean;
  confidenceThreshold: number;
  defaultInboxRetention: number;
  theme: AppTheme;
}

export const DEFAULT_USER_SETTINGS: UserSettings = {
  enableVideoUpload: true,
  autoFileHighConfidence: true,
  notificationsEnabled: true,
  confidenceThreshold: 0.85,
  defaultInboxRetention: 30,
  theme: 'system',
};

// User Model
export interface User {
  id: string;
  email?: string;
  displayName?: string;
  avatarURL?: string;
  createdAt: string;
  settings: UserSettings;
}

// Auth Response
export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}

// Search Mode
export type SearchMode = 'semantic' | 'keyword';

// API Response types
export interface ItemsResponse {
  items: SaveItem[];
  total?: number;
}

export interface FoldersResponse {
  folders: Folder[];
}

export interface UploadURLResponse {
  uploadURL: string;
  expiresAt: string;
}

