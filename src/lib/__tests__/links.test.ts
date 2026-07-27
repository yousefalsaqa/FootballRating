/** @jest-environment node */

import {
  extractHandleFromUrl,
  isInstagramPostUrl,
  normalizeHandle,
  normalizeSourceUrl,
  usernameMatchesJournalist,
} from '@/lib/links';

describe('extractHandleFromUrl', () => {
  test.each([
    ['https://x.com/FabrizioRomano/status/1234567890', 'fabrizioromano'],
    ['https://twitter.com/David_Ornstein/status/1?s=20', 'david_ornstein'],
    ['http://www.x.com/Plettigoal', 'plettigoal'],
    ['x.com/JacobsBen/status/9', 'jacobsben'],
    ['https://mobile.twitter.com/cfbayern', 'cfbayern'],
    ['https://www.instagram.com/fabrizioromano/reel/Cxyz/', 'fabrizioromano'],
    ['instagram.com/FabrizioRomano', 'fabrizioromano'],
    ['https://www.snapchat.com/add/fabrizioromano', 'fabrizioromano'],
    ['https://snapchat.com/@fabrizioromano', 'fabrizioromano'],
  ])('%s → %s', (url, handle) => {
    expect(extractHandleFromUrl(url)).toBe(handle);
  });

  test.each([
    'not a url',
    'https://example.com/FabrizioRomano',
    'https://x.com/search?q=romano',
    'https://x.com/i/status/123',
    'https://x.com/home',
    'https://www.instagram.com/reel/Cxyz/',
    'https://snapchat.com/discover',
    '',
  ])('rejects %s', (input) => {
    expect(extractHandleFromUrl(input)).toBeNull();
  });
});

describe('normalizeSourceUrl', () => {
  test('unwraps a Bing redirect with entity-encoded ampersands', () => {
    const wrapped =
      'http://www.bing.com/news/apiclick.aspx?ref=FexRss&amp;aid=&amp;tid=abc&amp;url=https%3a%2f%2fmetro.co.uk%2f2026%2f07%2f27%2fstory%2f&amp;c=123&amp;mkt=en-us';
    expect(normalizeSourceUrl(wrapped)).toBe('https://metro.co.uk/2026/07/27/story/');
  });

  test('unwraps a plain Bing redirect', () => {
    const wrapped = 'https://www.bing.com/news/apiclick.aspx?tid=x&url=https%3a%2f%2fexample.com%2fa&c=1';
    expect(normalizeSourceUrl(wrapped)).toBe('https://example.com/a');
  });

  test('handles double-encoded ampersands', () => {
    const wrapped = 'http://www.bing.com/news/apiclick.aspx?a=1&amp;amp;url=https%3a%2f%2fexample.com%2fb';
    expect(normalizeSourceUrl(wrapped)).toBe('https://example.com/b');
  });

  test('leaves normal links alone', () => {
    expect(normalizeSourceUrl('https://www.instagram.com/p/DbRFbMpxFr7/')).toBe(
      'https://www.instagram.com/p/DbRFbMpxFr7/',
    );
  });
});

describe('isInstagramPostUrl', () => {
  test.each([
    'https://www.instagram.com/p/DbRFbMpxFr7/?utm_source=ig_web_copy_link&igsh=MzRlODBiNWFlZA==',
    'https://www.instagram.com/reel/Cxyz123/',
    'instagram.com/fabriziorom/p/DbRFbMpxFr7/',
  ])('accepts %s', (url) => {
    expect(isInstagramPostUrl(url)).toBe(true);
  });

  test.each(['https://www.instagram.com/fabriziorom/', 'https://x.com/FabrizioRomano/status/1', 'plain text'])(
    'rejects %s',
    (url) => {
      expect(isInstagramPostUrl(url)).toBe(false);
    },
  );
});

describe('usernameMatchesJournalist', () => {
  test('matches exact handle', () => {
    expect(usernameMatchesJournalist('dimarzio', 'Gianluca Di Marzio', 'dimarzio')).toBe(true);
  });

  test('matches a per-platform handle variant against the real name', () => {
    // IG @fabriziorom vs X handle fabrizioromano
    expect(usernameMatchesJournalist('fabriziorom', 'Fabrizio Romano', 'fabrizioromano')).toBe(true);
  });

  test('ignores dots/underscores and accents', () => {
    expect(usernameMatchesJournalist('david.ornstein', 'David Ornstein', 'david_ornstein')).toBe(true);
    expect(usernameMatchesJournalist('alfredopedulla', 'Alfredo Pedullà', 'alfredopedulla')).toBe(true);
  });

  test('rejects unrelated usernames', () => {
    expect(usernameMatchesJournalist('433', 'Fabrizio Romano', 'fabrizioromano')).toBe(false);
    expect(usernameMatchesJournalist('espnfc', 'David Ornstein', 'david_ornstein')).toBe(false);
  });
});

describe('normalizeHandle', () => {
  test('strips @ and lowercases', () => {
    expect(normalizeHandle('@FabrizioRomano')).toBe('fabrizioromano');
    expect(normalizeHandle('  David_Ornstein ')).toBe('david_ornstein');
  });

  test('rejects invalid handles', () => {
    expect(normalizeHandle('way too long for a twitter handle')).toBeNull();
    expect(normalizeHandle('has space')).toBeNull();
    expect(normalizeHandle('')).toBeNull();
  });
});
