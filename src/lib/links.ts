/**
 * Parsing of pasted social links (X/Twitter, Instagram, Snapchat) — used by
 * the paste-a-link lookup. All platforms match against the journalist's one
 * stored handle; most reporters use the same name everywhere.
 */

const URL_PATTERNS = [
  // x.com/FabrizioRomano/status/123 · twitter.com/...
  /(?:https?:\/\/)?(?:www\.|mobile\.)?(?:x\.com|twitter\.com)\/(@?[A-Za-z0-9_]{1,15})(?:[/?#]|$)/i,
  // instagram.com/fabrizioromano/reel/... (handles allow dots)
  /(?:https?:\/\/)?(?:www\.)?instagram\.com\/(@?[A-Za-z0-9_.]{1,30})(?:[/?#]|$)/i,
  // snapchat.com/add/handle · snapchat.com/@handle
  /(?:https?:\/\/)?(?:www\.)?snapchat\.com\/(?:add\/)?(@?[A-Za-z0-9_.-]{1,30})(?:[/?#]|$)/i,
];

/** Non-profile first path segments across the supported platforms. */
const RESERVED_PATHS = new Set([
  'home',
  'search',
  'explore',
  'i',
  'intent',
  'hashtag',
  'share',
  'notifications',
  'messages',
  'settings',
  'compose',
  'login',
  'signup',
  // instagram
  'p',
  'reel',
  'reels',
  'stories',
  'tv',
  'accounts',
  // snapchat
  'add',
  'discover',
  'spotlight',
  't',
]);

/**
 * Extracts the author handle (lowercase, no @) from a pasted social URL,
 * e.g. "https://x.com/FabrizioRomano/status/123" → "fabrizioromano".
 * Returns null when the text isn't such a link.
 */
export function extractHandleFromUrl(text: string): string | null {
  for (const pattern of URL_PATTERNS) {
    const match = text.trim().match(pattern);
    if (match?.[1]) {
      const handle = match[1].replace(/^@/, '').toLowerCase();
      if (!RESERVED_PATHS.has(handle)) {
        return handle;
      }
    }
  }
  return null;
}

/**
 * True when the text is a supported social URL even if no author handle could
 * be extracted (e.g. instagram.com/p/<post> — IG post links omit the author).
 */
export function isSocialUrl(text: string): boolean {
  return /(?:x\.com|twitter\.com|instagram\.com|snapchat\.com)\//i.test(text.trim());
}

/** Unwraps Bing News redirect links to the real article URL. */
export function normalizeSourceUrl(link: string): string {
  // Bing entity-encodes (sometimes doubly) the query ampersands; undecoded
  // `&amp;` turns the param key into "amp;url" and the unwrap silently fails.
  let candidate = link.trim();
  while (candidate.includes('&amp;')) {
    candidate = candidate.replace(/&amp;/g, '&');
  }
  try {
    const parsed = new URL(candidate);
    if (parsed.hostname.endsWith('bing.com')) {
      const real = parsed.searchParams.get('url');
      if (real) {
        return decodeURIComponent(real);
      }
    }
  } catch {
    // keep original
  }
  return candidate;
}

/**
 * Matches an Instagram post/reel URL — these omit the author, so the app asks
 * the ingest worker to read the post's author (see worker `/author`).
 */
export function isInstagramPostUrl(text: string): boolean {
  return /instagram\.com\/(?:[^/?#]+\/)?(?:p|reel|reels|tv)\/[A-Za-z0-9_-]+/i.test(text.trim());
}

/**
 * Whether a social username belongs to a journalist. Reporters often vary
 * their handle per platform (X @fabrizioromano vs IG @fabriziorom), so beyond
 * an exact handle match we accept a long-enough prefix relationship with the
 * stored handle or the collapsed real name.
 */
export function usernameMatchesJournalist(
  username: string,
  name: string,
  handle: string | null | undefined,
): boolean {
  const candidate = username.trim().replace(/^@/, '').toLowerCase().replace(/[._]/g, '');
  if (!candidate) {
    return false;
  }
  const collapsedName = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '');
  const collapsedHandle = (handle ?? '').toLowerCase().replace(/[._]/g, '');
  if (candidate === collapsedHandle || candidate === collapsedName) {
    return true;
  }
  const prefixOf = (a: string, b: string) =>
    a.length >= 6 && b.length >= 6 && (a.startsWith(b) || b.startsWith(a));
  return prefixOf(candidate, collapsedHandle) || prefixOf(candidate, collapsedName);
}

/** Normalizes user-entered handles: strips @, spaces, lowercases. */
export function normalizeHandle(input: string): string | null {
  const handle = input.trim().replace(/^@/, '').toLowerCase();
  return /^[a-z0-9_]{1,15}$/.test(handle) ? handle : null;
}
