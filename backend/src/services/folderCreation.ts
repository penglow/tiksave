import { query } from '../database/init.js';

interface FolderSuggestion {
  name: string;
  parentId: string | null;
  iconName?: string;
}

/**
 * Suggest a folder name based on topics and labels
 * Avoids being too specific by using general categories
 */
function suggestFolderName(topics: string[], labels: string[], suggestedName?: string): string | null {
  // 1. Use AI suggested name if available and not generic
  if (suggestedName && suggestedName !== 'Saved') {
    return suggestedName;
  }

  // 2. Prioritize AI-generated hierarchical topics
  if (topics.length > 0 && topics[0].includes(' > ')) {
    return topics[0];
  }

  // 3. Combine topics and labels, prioritizing topics
  const allTerms = [...topics, ...labels.map(l => l.toLowerCase())];

  if (allTerms.length === 0) {
    return null;
  }

  // 4. Map to general categories to avoid being too specific (Fallback)
  const categoryMap: { [key: string]: string } = {
    // Food-related
    'food': 'Food',
    'restaurant': 'Food',
    'cooking': 'Food',
    'recipe': 'Food',
    'dining': 'Food',
    'cafe': 'Food',
    'bakery': 'Food',
    'ramen': 'Food',
    'sushi': 'Food',
    'pizza': 'Food',
    'burger': 'Food',
    'dessert': 'Food',
    'coffee': 'Food',
    'drink': 'Food',

    // Travel/Location
    'japan': 'Travel',
    'tokyo': 'Travel',
    'osaka': 'Travel',
    'kyoto': 'Travel',
    'korea': 'Travel',
    'seoul': 'Travel',
    'travel': 'Travel',
    'vacation': 'Travel',
    'trip': 'Travel',

    // Hotels/Accommodation
    'hotel': 'Hotels',
    'accommodation': 'Hotels',
    'stay': 'Hotels',
    'room': 'Hotels',
    'hostel': 'Hotels',
    'ryokan': 'Hotels',

    // Attractions
    'attraction': 'Attractions',
    'sightseeing': 'Attractions',
    'temple': 'Attractions',
    'shrine': 'Attractions',
    'museum': 'Attractions',
    'park': 'Attractions',
    'landmark': 'Attractions',

    // Shopping
    'shopping': 'Shopping',
    'store': 'Shopping',
    'mall': 'Shopping',
    'market': 'Shopping',
    'haul': 'Shopping',

    // Fitness
    'gym': 'Gym',
    'workout': 'Gym',
    'fitness': 'Gym',
    'exercise': 'Gym',
    'training': 'Gym',

    // Beauty/Fashion
    'beauty': 'Beauty',
    'makeup': 'Beauty',
    'skincare': 'Beauty',
    'fashion': 'Fashion',
    'style': 'Fashion',
    'outfit': 'Fashion',

    // Tech
    'tech': 'Tech',
    'technology': 'Tech',
    'gadget': 'Tech',
    'app': 'Tech',
    'software': 'Tech',

    // Entertainment
    'movie': 'Entertainment',
    'music': 'Entertainment',
    'game': 'Entertainment',
    'gaming': 'Entertainment',
  };

  // Check each term for a category match
  for (const term of allTerms) {
    const termLower = term.toLowerCase();
    // Direct match
    if (categoryMap[termLower]) {
      return categoryMap[termLower];
    }
  }

  // If no category match, use the first topic (capitalized)
  if (topics.length > 0) {
    const firstTopic = topics[0];
    // Capitalize first letter
    return firstTopic.charAt(0).toUpperCase() + firstTopic.slice(1);
  }

  return null;
}

/**
 * Get icon for a folder name
 */
function getIconForFolder(folderName: string, suggestedEmoji?: string): string {
  if (suggestedEmoji) {
    return suggestedEmoji;
  }

  const iconMap: { [key: string]: string } = {
    'Food': '🍜',
    'Japan': '🇯🇵',
    'Travel': '✈️',
    'Hotels': '🏨',
    'Attractions': '⛩️',
    'Shopping': '🛍️',
    'Gym': '💪',
    'Beauty': '💄',
    'Fashion': '👗',
    'Tech': '💻',
    'Entertainment': '🎬',
    'Saved': '💾',
  };

  // Check for partial matches in map keys
  for (const [key, icon] of Object.entries(iconMap)) {
    if (folderName.includes(key)) {
      return icon;
    }
  }

  return '📁';
}

/**
 * Find a parent folder that matches a location/category
 * Returns null if no suitable parent found
 */
async function findParentFolder(
  userId: string,
  suggestedName: string
): Promise<string | null> {
  // Check for explicit "Parent > Child" structure
  if (suggestedName.includes(' > ')) {
    const parentName = suggestedName.split(' > ')[0];
    const parentResult = await query(
      `SELECT id FROM folders 
       WHERE user_id = $1 AND name = $2 AND parent_id IS NULL`,
      [userId, parentName]
    );

    if (parentResult.rows.length > 0) {
      return parentResult.rows[0].id;
    }
  }

  // Check if there's a location parent (e.g., "Japan" for "Japan Food")
  const locationParents = ['Japan', 'Korea', 'China', 'Thailand', 'Vietnam', 'Travel', 'Food', 'Hotels', 'Attractions', 'Shopping'];

  for (const location of locationParents) {
    if (suggestedName.includes(location) && suggestedName !== location) {
      // Check if parent exists
      const parentResult = await query(
        `SELECT id FROM folders 
         WHERE user_id = $1 AND name = $2 AND parent_id IS NULL`,
        [userId, location]
      );

      if (parentResult.rows.length > 0) {
        return parentResult.rows[0].id;
      }
    }
  }

  return null;
}

/**
 * Create or find a folder for the given topics/labels
 * Returns the folder ID
 */
export async function createOrFindFolder(
  userId: string,
  topics: string[],
  labels: string[],
  suggestedFolderName?: string,
  suggestedEmoji?: string
): Promise<{ folderId: string; folderName: string } | null> {
  // Suggest folder name
  const suggestedName = suggestFolderName(topics, labels, suggestedFolderName);

  // console.log(`   🔍 Folder creation - topics: ${topics.join(', ')}, suggested: ${suggestedName || 'none'}, emoji: ${suggestedEmoji || 'none'}`);

  if (!suggestedName) {
    // console.log('   ⚠️ No folder name suggested, returning null');
    return null;
  }

  // Check if folder already exists (top-level)
  const existingResult = await query(
    `SELECT id, name FROM folders 
     WHERE user_id = $1 AND name = $2 AND parent_id IS NULL`,
    [userId, suggestedName]
  );

  if (existingResult.rows.length > 0) {
    return {
      folderId: existingResult.rows[0].id,
      folderName: existingResult.rows[0].name,
    };
  }

  // Check if we should create a subfolder
  const parentId = await findParentFolder(userId, suggestedName);

  // If parent exists and suggested name is a combination (e.g., "Japan Food")
  // Create as subfolder, but only if it makes sense
  let finalName = suggestedName;
  let finalParentId = parentId;

  // Handle hierarchical names (e.g., "Food > Japanese Street Food")
  if (suggestedName.includes(' > ')) {
    const parts = suggestedName.split(' > ');
    const parentName = parts[0];
    const childName = parts[parts.length - 1];

    if (!finalParentId) {
      // Create parent folder if it doesn't exist
      const parentIcon = getIconForFolder(parentName);
      const parentSortResult = await query(
        `SELECT COALESCE(MAX(sort_order), -1) + 1 as next_order
         FROM folders 
         WHERE user_id = $1 AND parent_id IS NULL`,
        [userId]
      );

      const newParent = await query(
        `INSERT INTO folders (user_id, name, parent_id, icon_name, sort_order)
          VALUES ($1, $2, NULL, $3, $4)
          RETURNING id`,
        [userId, parentName, parentIcon, parentSortResult.rows[0].next_order]
      );
      finalParentId = newParent.rows[0].id;
    }

    finalName = childName;
  } else if (parentId && suggestedName.includes(' ')) {
    // Handle legacy "Parent Child" format or inferred subfolders
    const parts = suggestedName.split(' ');
    // often the last word is the specific one, or the whol phrase is specific
    // For now, let's keep the full name if we can't cleanly split, but if parent is "Japan" and child is "Japan Food", we might want just "Food"?
    // Let's rely on the specific name being distinct enough.

    // Actually, if we have a parent, we probably want to strip the parent name from the child name if it's redundant
    // e.g. Parent: "Japan", Child: "Japan Food" -> Subfolder: "Food"
    // But "Tokyo Trip" under "Japan" should stay "Tokyo Trip".

    // Simple heuristic: if child starts with parent name, strip it?
    // No, "Japan Food" -> "Food" is good. "Tokyo Trip" -> "Tokyo Trip" is good.
  }

  // Check if folder with this name and parent already exists
  const duplicateCheck = await query(
    `SELECT id, name FROM folders 
     WHERE user_id = $1 AND name = $2 AND parent_id IS NOT DISTINCT FROM $3`,
    [userId, finalName, finalParentId]
  );

  if (duplicateCheck.rows.length > 0) {
    return {
      folderId: duplicateCheck.rows[0].id,
      folderName: duplicateCheck.rows[0].name,
    };
  }

  // Get sort order
  const sortResult = await query(
    `SELECT COALESCE(MAX(sort_order), -1) + 1 as next_order
     FROM folders 
     WHERE user_id = $1 AND parent_id IS NOT DISTINCT FROM $2`,
    [userId, finalParentId]
  );

  const sortOrder = sortResult.rows[0].next_order;
  const iconName = getIconForFolder(finalName, suggestedEmoji);

  // Create folder
  const result = await query(
    `INSERT INTO folders (user_id, name, parent_id, icon_name, sort_order)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, name`,
    [userId, finalName, finalParentId, iconName, sortOrder]
  );

  // console.log(`📁 Created new folder: ${finalName}${finalParentId ? ' (subfolder)' : ''} ${iconName}`);

  return {
    folderId: result.rows[0].id,
    folderName: result.rows[0].name,
  };
}

