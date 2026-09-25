export const DAYS_PER_MONTH = 30

export function runwayDaysFromMonths(months: number): number {
  return Math.floor(Number((months * DAYS_PER_MONTH).toFixed(6)))
}

/** "272 days (≈9.1 months)" — the single display format for a runway figure. */
export function formatRunway(months: number): string {
  if (!Number.isFinite(months)) {
    return 'unavailable'
  }

  const days = runwayDaysFromMonths(months)
  const dayLabel = Math.abs(days) === 1 ? 'day' : 'days'

  return `${days} ${dayLabel} (≈${months.toFixed(1)} months)`
}
