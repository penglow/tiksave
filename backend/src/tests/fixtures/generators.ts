/**
 * Programmatic test-case generators — builds thousands of matrix rows from small seeds.
 */

export type MatrixCase<TInput = unknown, TExpected = unknown> = {
  id: string;
  input: TInput;
  expected: TExpected;
  label?: string;
};

let caseCounter = 0;

export function nextCaseId(prefix: string): string {
  caseCounter += 1;
  return `${prefix}-${caseCounter}`;
}

/** Reset counter between test files (optional). */
export function resetCaseIds(): void {
  caseCounter = 0;
}

export function cartesianProduct<A, B>(a: A[], b: B[]): Array<[A, B]> {
  const out: Array<[A, B]> = [];
  for (const x of a) {
    for (const y of b) {
      out.push([x, y]);
    }
  }
  return out;
}

/** Generate TikTok video URL variants. */
export function generateTikTokVideoUrls(count: number): string[] {
  const hosts = ['www.tiktok.com', 'tiktok.com', 'm.tiktok.com'];
  const users = Array.from({ length: 20 }, (_, i) => `creator_${i}`);
  const urls: string[] = [];

  for (let i = 0; i < count; i++) {
    const host = hosts[i % hosts.length];
    const user = users[i % users.length];
    const videoId = 7000000000000000000n + BigInt(i);
    const suffix = i % 5 === 0 ? '?lang=en' : i % 7 === 0 ? '&_r=1' : '';
    urls.push(`https://${host}/@${user}/video/${videoId}${suffix}`);
  }
  return urls;
}

export function generateVmTikTokUrls(count: number): string[] {
  return Array.from({ length: count }, (_, i) => `https://vm.tiktok.com/ZM${(i + 1).toString(36).padStart(8, '0')}/`);
}

export function generateInvalidUrls(count: number): string[] {
  const bases = [
    'javascript:alert(1)',
    'file:///etc/passwd',
    'ftp://tiktok.com/video',
    'http://127.0.0.1/video',
    'http://localhost/video',
    'http://10.0.0.1/video',
    'http://192.168.1.1/video',
    'http://169.254.0.1/video',
    'https://evil.com/@user/video/1',
    'https://tiktok.evil.com/video/1',
    'not-a-url',
    '',
    '   ',
  ];
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    out.push(bases[i % bases.length] + (i > bases.length ? `?n=${i}` : ''));
  }
  return out;
}

export function generateHtmlInjectionStrings(count: number): string[] {
  const payloads = [
    '<script>alert(1)</script>',
    '<img src=x onerror=alert(1)>',
    '<svg onload=alert(1)>',
    'hello<script>evil</script>world',
    '<b>bold</b>',
    '<a href="http://evil.com">link</a>',
    'onclick=alert(1)',
    '<iframe src="evil">',
    '&#60;script&#62;',
    '\0null-byte',
  ];
  return Array.from({ length: count }, (_, i) => {
    const base = payloads[i % payloads.length];
    return `${'x'.repeat(i % 10)}${base}${'y'.repeat(i % 5)}`;
  });
}

export function generateEmails(count: number): Array<{ raw: string; valid: boolean }> {
  const valid = ['user@example.com', 'a.b+c@sub.domain.co', 'x@y.z'];
  const invalid = ['', 'bad', '@.', 'a@', '@b.com', 'a b@c.com', 'a@b', 'a@@b.com'];
  const out: Array<{ raw: string; valid: boolean }> = [];
  for (let i = 0; i < count; i++) {
    const pool = i % 2 === 0 ? valid : invalid;
    out.push({ raw: pool[i % pool.length], valid: i % 2 === 0 });
  }
  return out;
}

export function generatePaginationLimits(count: number): Array<{ query: Record<string, unknown>; expected: number }> {
  const out: Array<{ query: Record<string, unknown>; expected: number }> = [];
  for (let i = 0; i < count; i++) {
    const raw = [-100, 0, 1, 20, 50, 99, 100, 101, 999, 'abc', '', undefined, null, '50'][i % 14];
    const query = raw === undefined ? {} : { limit: raw as string | number };
    let expected = 20;
    if (typeof raw === 'number' && !Number.isNaN(raw)) {
      expected = Math.max(1, Math.min(100, raw));
    } else if (raw === '50') {
      expected = 50;
    }
    out.push({ query, expected });
  }
  return out;
}

export function generateHashtagTexts(count: number): Array<{ text: string; tags: string[] }> {
  const tags = ['#Food', '#travel', '#Tech2024', '#a', '#UPPER'];
  const out: Array<{ text: string; tags: string[] }> = [];
  for (let i = 0; i < count; i++) {
    const slice = tags.slice(0, (i % tags.length) + 1);
    const text = `Caption ${slice.join(' ')} end`;
    out.push({
      text,
      tags: slice.map((t) => t.toLowerCase()),
    });
  }
  return out;
}

export function generateCursorRoundTrips(count: number): Array<{ createdAt: string; id: string }> {
  return Array.from({ length: count }, (_, i) => ({
    createdAt: new Date(Date.UTC(2024, 0, 1, 0, 0, i)).toISOString(),
    id: `00000000-0000-4000-8000-${i.toString(16).padStart(12, '0')}`,
  }));
}
