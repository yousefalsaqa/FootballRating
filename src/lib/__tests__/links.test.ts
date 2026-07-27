/** @jest-environment node */

import { extractHandleFromUrl, normalizeHandle } from '@/lib/links';

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
