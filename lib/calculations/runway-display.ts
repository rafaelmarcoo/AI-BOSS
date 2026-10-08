export const DAYS_PER_MONTH = 30

export function runwayDaysFromMonths(months: number): number {
  return Math.floor(Number((months * DAYS_PER_MONTH).toFixed(6)))
}

function plural(count: number, singular: string, pluralForm: string) {
  return `${count} ${Math.abs(count) === 1 ? singular : pluralForm}`
}


export function formatRunway(months: number): string {
  if (!Number.isFinite(months)) {
    return 'unavailable'
  }

  const days = runwayDaysFromMonths(months)
  const asMonths = monthsAndDays(days)
  return asMonths ? `${asMonths} (${days} days)` : plural(days, 'day', 'days')
}

export function monthsAndDays(days: number): string | null {
  const wholeMonths = Math.floor(days / DAYS_PER_MONTH)
  if (wholeMonths <= 0) return null

  const remainingDays = days % DAYS_PER_MONTH
  return [
    plural(wholeMonths, 'month', 'months'),
    remainingDays > 0 ? plural(remainingDays, 'day', 'days') : null,
  ]
    .filter((part): part is string => part !== null)
    .join(' ')
}
