/** Mass matrix tests for folder icon fallbacks (~250+ cases). */

import { describe, it, expect } from 'bun:test';
import { getDisplayIcon, type Folder } from '../../types';
import { generateFolderNames } from '../fixtures/generators';

const NAMES = generateFolderNames(150);

function folderWithName(name: string, iconName?: string): Folder {
  return {
    id: 'f1',
    name,
    sortOrder: 0,
    isDefault: false,
    itemCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    iconName,
  };
}

describe('folderIcons.matrix — getDisplayIcon', () => {
  for (let i = 0; i < NAMES.length; i++) {
    const name = NAMES[i];
    it(`fallback for "${name}" (${i})`, () => {
      const icon = getDisplayIcon(folderWithName(name));
      expect(icon.length).toBeGreaterThan(0);
    });
  }

  for (let i = 0; i < 50; i++) {
    it(`explicit iconName ${i}`, () => {
      expect(getDisplayIcon(folderWithName('Any', '⭐'))).toBe('⭐');
    });
  }

  const keywordExpectations: Array<[string, string]> = [
    ['Japan trip', '🇯🇵'],
    ['Korea food', '🇰🇷'],
    ['Tech review', '📱'],
    ['Gym day', '💪'],
    ['Comedy skit', '😂'],
    ['Unknown folder', '📁'],
  ];

  for (let i = 0; i < keywordExpectations.length; i++) {
    const [name, emoji] = keywordExpectations[i];
    for (let j = 0; j < 5; j++) {
      it(`${name} => ${emoji} #${j}`, () => {
        expect(getDisplayIcon(folderWithName(name))).toBe(emoji);
      });
    }
  }
});
