const DAYS_PER_RUNWAY_MONTH = 30

function plural(value: number, unit: 'month' | 'day') {
  return `${value} ${unit}${value === 1 ? '' : 's'}`
}

export function formatRunwayDuration(value: number) {
  if (!Number.isFinite(value)) return 'Unavailable'
  if (value <= 0) return '0 days'

  const totalDays = Math.max(1, Math.round(value * DAYS_PER_RUNWAY_MONTH))
  const months = Math.floor(totalDays / DAYS_PER_RUNWAY_MONTH)
  const days = totalDays % DAYS_PER_RUNWAY_MONTH
  return [
    ...(months > 0 ? [plural(months, 'month')] : []),
    ...(days > 0 ? [plural(days, 'day')] : []),
  ].join(', ')
}

export function formatRunwayChange(value: number) {
  if (!Number.isFinite(value)) return 'Unavailable'
  if (value === 0) return '0 days'
  return `${value > 0 ? '+' : '-'}${formatRunwayDuration(Math.abs(value))}`
}
