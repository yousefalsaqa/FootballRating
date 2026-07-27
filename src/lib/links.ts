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

/** Normalizes user-entered handles: strips @, spaces, lowercases. */
export function normalizeHandle(input: string): string | null {
  const handle = input.trim().replace(/^@/, '').toLowerCase();
  return /^[a-z0-9_]{1,15}$/.test(handle) ? handle : null;
}
