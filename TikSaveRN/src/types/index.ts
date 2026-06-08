/**
 * Shared domain types, models, and display helpers for TikSave.
 * Barrel export for save items, folders, auth, pagination, and user settings.
 */

// ---------------------------------------------------------------------------
// Save item status
// ---------------------------------------------------------------------------

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

/** Whether the item is still in a processing/upload pipeline state. */
export const isLoadingStatus = (status: SaveItemStatus): boolean => {
  return ['queued', 'upload_requested', 'uploading', 'processing'].includes(status);
};

/** Shown on Library browse (excludes queued/processing uploads). */
export const isLibraryListedStatus = (status: SaveItemStatus): boolean =>
  status === 'ready' || status === 'needs_review';

// ---------------------------------------------------------------------------
// Save item model
// ---------------------------------------------------------------------------

export interface SaveItem {
  id: string;
  // For map: when the same item appears multiple times (one per location), this disambiguates markers
  locationId?: string;
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
  processingStage?: string;
  processingProgress?: number;
  processingMessage?: string;
  latitude?: number;
  longitude?: number;
  locationName?: string;
  address?: string;
}

// ---------------------------------------------------------------------------
// Save item helpers
// ---------------------------------------------------------------------------

/** Prefer title, then truncated transcript, then a generic fallback. */
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

/** Whether the item should surface in a review queue. */
export const needsUserReview = (item: SaveItem, mediumConfidenceThreshold = 0.6): boolean => {
  return item.status === 'needs_review' || (item.confidence ?? 0) < mediumConfidenceThreshold;
};

export type ConfidenceLevel = 'high' | 'medium' | 'low';

/** Map raw confidence score to a discrete level for UI badges. */
export const getConfidenceLevel = (
  confidence: number | undefined,
  highThreshold = 0.85,
  mediumThreshold = 0.6,
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

// ---------------------------------------------------------------------------
// Folder rules and models
// ---------------------------------------------------------------------------

export type RuleField = 'topic' | 'label' | 'transcript' | 'hashtag' | 'creator';
export type RuleOperation = 'contains' | 'equals' | 'startsWith' | 'matches';

export interface FolderRule {
  id: string;
  field: RuleField;
  operation: RuleOperation;
  value: string;
  weight: number;
}

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

/** Tree node wrapping a folder and its children. */
export interface FolderNode {
  folder: Folder;
  children: FolderNode[];
}

// ---------------------------------------------------------------------------
// Folder display helpers
// ---------------------------------------------------------------------------

/** Resolve folder icon from stored iconName or name-based fallback. */
export const getDisplayIcon = (folder: Folder): string => {
  // Check if iconName exists and is not empty
  if (folder.iconName && folder.iconName.trim().length > 0) {
    return folder.iconName.trim();
  }
  // Fallback to default icon based on folder name
  return getFolderFallbackIcon(folder.name);
};

const getFolderFallbackIcon = (name: string): string => {
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return '📁';
  }

  const lowercased = name.toLowerCase().trim();

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

  if (lowercased.includes('food') || lowercased.includes('recipe')) return '🍽️';
  if (lowercased.includes('hotel') || lowercased.includes('stay')) return '🏨';
  if (lowercased.includes('attraction') || lowercased.includes('sightseeing')) return '🎡';
  if (lowercased.includes('shopping') || lowercased.includes('haul')) return '🛍️';
  if (
    lowercased.includes('gym') ||
    lowercased.includes('fitness') ||
    lowercased.includes('workout')
  )
    return '💪';
  if (lowercased.includes('car') || lowercased.includes('auto')) return '🚗';
  if (
    lowercased.includes('finance') ||
    lowercased.includes('money') ||
    lowercased.includes('invest')
  )
    return '💰';
  if (lowercased.includes('tech') || lowercased.includes('gadget')) return '📱';
  if (
    lowercased.includes('fashion') ||
    lowercased.includes('style') ||
    lowercased.includes('outfit')
  )
    return '👗';
  if (
    lowercased.includes('beauty') ||
    lowercased.includes('makeup') ||
    lowercased.includes('skincare')
  )
    return '💄';
  if (lowercased.includes('pet') || lowercased.includes('dog') || lowercased.includes('cat'))
    return '🐾';
  if (lowercased.includes('diy') || lowercased.includes('craft')) return '🔨';
  if (lowercased.includes('music')) return '🎵';
  if (lowercased.includes('dance')) return '💃';
  if (lowercased.includes('comedy') || lowercased.includes('funny')) return '😂';
  if (lowercased.includes('education') || lowercased.includes('learn')) return '📚';

  return '📁';
};

// ---------------------------------------------------------------------------
// User settings
// ---------------------------------------------------------------------------

export type AppTheme = 'light' | 'dark' | 'system';

/** How topic rows are ordered on the Library screen */
export type LibraryCategorySort =
  | 'videos_desc'
  | 'videos_asc'
  | 'name_asc'
  | 'name_desc'
  | 'recent_activity';

/** Order of clips inside each topic strip on Library */
export type LibraryWithinTopicSort = 'newest_first' | 'oldest_first';

export const LIBRARY_CATEGORY_SORT_LABELS: Record<LibraryCategorySort, string> = {
  videos_desc: 'Most videos first',
  videos_asc: 'Fewest videos first',
  name_asc: 'Topic name A–Z',
  name_desc: 'Topic name Z–A',
  recent_activity: 'Recently added (by topic)',
};

export const LIBRARY_WITHIN_TOPIC_LABELS: Record<LibraryWithinTopicSort, string> = {
  newest_first: 'Newest clips in each topic first',
  oldest_first: 'Oldest clips in each topic first',
};

export interface UserSettings {
  enableVideoUpload: boolean;
  autoFileHighConfidence: boolean;
  notificationsEnabled: boolean;
  confidenceThreshold: number;
  defaultInboxRetention: number;
  theme: AppTheme;
  libraryCategorySort: LibraryCategorySort;
  libraryWithinTopicSort: LibraryWithinTopicSort;
}

export const DEFAULT_USER_SETTINGS: UserSettings = {
  enableVideoUpload: true,
  autoFileHighConfidence: true,
  notificationsEnabled: true,
  confidenceThreshold: 0.85,
  defaultInboxRetention: 30,
  theme: 'light',
  libraryCategorySort: 'videos_desc',
  libraryWithinTopicSort: 'newest_first',
};

// ---------------------------------------------------------------------------
// User and auth
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

export type SearchMode = 'semantic' | 'keyword';

// ---------------------------------------------------------------------------
// API response types
// ---------------------------------------------------------------------------

export interface ItemsResponse {
  items: SaveItem[];
  total?: number;
  pagination?: PaginationInfo;
}

export interface FoldersResponse {
  folders: Folder[];
}

export interface UploadURLResponse {
  uploadURL: string;
  expiresAt: string;
}

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

export interface PaginationInfo {
  nextCursor: string | null;
  prevCursor: string | null;
  hasMore: boolean;
}

export interface PaginationParams {
  cursor?: string;
  limit?: number;
  direction?: 'next' | 'prev';
}

// Legacy offset-based pagination (for backward compatibility)
export interface OffsetPaginationParams {
  limit?: number;
  offset?: number;
}
