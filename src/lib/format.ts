import { format } from 'date-fns';

/** Shared display formatting — the only place numbers/dates become strings. */

export function formatDate(epochMs: number): string {
  return format(epochMs, 'd MMM yyyy');
}

/** Scores render as whole numbers ("87"). */
export function formatScore(score: number): string {
  return String(Math.round(score));
}

/** Accuracy in 0–1 renders as a percentage ("82%"). */
export function formatAccuracy(accuracy: number | null): string {
  return accuracy === null ? '—' : `${Math.round(accuracy * 100)}%`;
}

/** Signed one-decimal delta ("+1.2", "−0.8") for score impact. */
export function formatDelta(delta: number): string {
  const rounded = Math.round(delta * 10) / 10;
  if (rounded === 0) {
    return '±0.0';
  }
  return `${rounded > 0 ? '+' : '−'}${Math.abs(rounded).toFixed(1)}`;
}

/** Initials for avatar circles ("Fabrizio Romano" → "FR"). */
export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => (part[0] ?? '').toUpperCase())
    .join('');
}
