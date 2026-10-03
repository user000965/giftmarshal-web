const wholeDollars = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const withCents = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });

/** Money is integer cents in USD everywhere; this is the only place it becomes text. */
export function formatUsd(cents: number): string {
  if (!Number.isInteger(cents)) throw new Error(`cents must be an integer, got ${cents}`);
  return cents % 100 === 0 ? wholeDollars.format(cents / 100) : withCents.format(cents / 100);
}

export function progressPercent(progressCents: number, targetCents: number): number {
  if (targetCents <= 0) return 0;
  return Math.min(100, Math.max(0, Math.floor((progressCents / targetCents) * 100)));
}
