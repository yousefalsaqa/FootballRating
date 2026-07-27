/** Avatar background colors assigned to journalists (stored per-row). */
export const AVATAR_COLORS = [
  '#4A6FA5',
  '#5E8C61',
  '#8C6D4F',
  '#7B5E8C',
  '#A5584A',
  '#4A8C85',
  '#8C8149',
  '#665E70',
] as const;

/** Deterministic avatar color for a display name. */
export function avatarColorFor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length] as string;
}
