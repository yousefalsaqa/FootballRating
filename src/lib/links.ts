/** Parsing of pasted X/Twitter links — used by the paste-a-link lookup. */

const X_URL_PATTERN =
  /(?:https?:\/\/)?(?:www\.|mobile\.)?(?:x\.com|twitter\.com)\/(@?[A-Za-z0-9_]{1,15})(?:[/?#]|$)/i;

/** Non-profile first path segments on x.com. */
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
]);

/**
 * Extracts the author handle (lowercase, no @) from a pasted X/Twitter URL,
 * e.g. "https://x.com/FabrizioRomano/status/123" → "fabrizioromano".
 * Returns null when the text isn't such a link.
 */
export function extractHandleFromUrl(text: string): string | null {
  const match = text.trim().match(X_URL_PATTERN);
  if (!match?.[1]) {
    return null;
  }
  const handle = match[1].replace(/^@/, '').toLowerCase();
  return RESERVED_PATHS.has(handle) ? null : handle;
}

/** Normalizes user-entered handles: strips @, spaces, lowercases. */
export function normalizeHandle(input: string): string | null {
  const handle = input.trim().replace(/^@/, '').toLowerCase();
  return /^[a-z0-9_]{1,15}$/.test(handle) ? handle : null;
}
