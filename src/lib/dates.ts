/**
 * Transfer-window helpers. Windows are stored as "<year>-summer" | "<year>-winter".
 * Winter = January window of that year; summer = June–September of that year.
 */

export type TransferWindow = `${number}-${'summer' | 'winter'}`;

export function windowLabel(window: string): string {
  const [year, season] = window.split('-');
  if (!year || (season !== 'summer' && season !== 'winter')) {
    return window;
  }
  return `${season === 'summer' ? 'Summer' : 'Winter'} ${year}`;
}

/** The window a claim made today most likely refers to. */
export function currentTransferWindow(now: number): TransferWindow {
  const date = new Date(now);
  const year = date.getFullYear();
  const month = date.getMonth(); // 0-based
  // Oct–Dec point at next year's winter window; Feb–May at this year's summer.
  if (month >= 9) {
    return `${year + 1}-winter`;
  }
  if (month === 0) {
    return `${year}-winter`;
  }
  return `${year}-summer`;
}

/** Selectable windows for the claim form: current plus the next two. */
export function upcomingWindows(now: number): TransferWindow[] {
  const first = currentTransferWindow(now);
  const [yearStr, season] = first.split('-') as [string, 'summer' | 'winter'];
  const year = Number(yearStr);
  const next: TransferWindow[] =
    season === 'winter'
      ? [`${year}-summer`, `${year + 1}-winter`]
      : [`${year + 1}-winter`, `${year + 1}-summer`];
  return [first, ...next];
}
