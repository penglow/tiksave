/**
 * Frontend test-case generators.
 */

export function generateTikTokUrlsInText(
  count: number,
): Array<{ text: string; expected: string | null }> {
  const out: Array<{ text: string; expected: string | null }> = [];
  for (let i = 0; i < count; i++) {
    const url = `https://www.tiktok.com/@user${i}/video/${7000000000000000000n + BigInt(i)}`;
    const wrappers = [`Check this ${url}`, `${url} 🔥`, `(${url})`, `prefix ${url} suffix`, url];
    const text = wrappers[i % wrappers.length];
    out.push({ text, expected: url });
  }
  return out;
}

export function generateNonTikTokTexts(count: number): string[] {
  const samples = [
    'https://youtube.com/watch?v=1',
    'hello world',
    'https://instagram.com/reel/1',
    '',
    'tiktok.com without scheme',
  ];
  return Array.from({ length: count }, (_, i) => `${samples[i % samples.length]} ${i}`);
}

export function generateDurationCases(count: number): Array<{ seconds: number; expected: string }> {
  const out: Array<{ seconds: number; expected: string }> = [];
  for (let i = 0; i < count; i++) {
    const seconds = i * 7 + (i % 60);
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    out.push({
      seconds,
      expected: `${mins}:${secs.toString().padStart(2, '0')}`,
    });
  }
  return out;
}

export function buildSaveItem(
  overrides: Partial<import('../../types').SaveItem> = {},
): import('../../types').SaveItem {
  return {
    id: 'item-1',
    sourceURL: 'https://www.tiktok.com/@u/video/1',
    dateAdded: new Date().toISOString(),
    status: 'ready',
    detectedTopics: ['Food'],
    detectedLabels: [],
    ...overrides,
  };
}

export function generateFolderNames(count: number): string[] {
  const seeds = [
    'Japan Travel',
    'Korea Food',
    'Tech Gadgets',
    'Gym Workout',
    'Random',
    '',
    '   ',
    'MUSIC mixes',
  ];
  return Array.from(
    { length: count },
    (_, i) => seeds[i % seeds.length] + (i > seeds.length ? ` ${i}` : ''),
  );
}
