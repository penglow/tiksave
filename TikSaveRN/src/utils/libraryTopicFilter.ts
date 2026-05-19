/**
 * Library category filtering — parses AI topic strings and matches items to category routes.
 */

import { SaveItem, SaveItemStatus, isLibraryListedStatus } from '../types';

export function parseDetectedTopic(primaryTopic: string): {
  parentName: string;
  subName: string | null;
} {
  let parentName = primaryTopic;
  let subName: string | null = null;

  if (primaryTopic.includes(' > ')) {
    const parts = primaryTopic.split(' > ');
    parentName = parts[0].trim();
    subName = parts[1]?.trim() || null;
  }

  parentName = parentName.charAt(0).toUpperCase() + parentName.slice(1);

  return { parentName, subName };
}

/** True when the primary topic includes a subcategory segment (`Parent > Child`). */
export function itemHasSubcategoryTopic(
  item: Pick<SaveItem, 'detectedTopics'>,
): boolean {
  const primaryTopic = item.detectedTopics?.[0] || 'Saved';
  return parseDetectedTopic(primaryTopic).subName !== null;
}

export function itemBelongsToLibraryCategory(
  item: Pick<SaveItem, 'status' | 'detectedTopics'>,
  categoryName: string,
  subcategoryName?: string
): boolean {
  if (!isLibraryListedStatus(item.status as SaveItemStatus)) {
    return false;
  }

  const primaryTopic = item.detectedTopics?.[0] || 'Saved';
  const { parentName, subName } = parseDetectedTopic(primaryTopic);

  if (subcategoryName) {
    return parentName === categoryName && subName === subcategoryName;
  }

  return parentName === categoryName;
}
