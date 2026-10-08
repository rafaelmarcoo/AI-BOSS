import { formatRunway } from '@/lib/calculations/runway-display'

export function formatRunwayDuration(value: number) {
  const formatted = formatRunway(value)
  return formatted === 'unavailable' ? 'Unavailable' : formatted
}

export function formatRunwayChange(value: number) {
  if (!Number.isFinite(value)) return 'Unavailable'
  if (value === 0) return '0 days'
  return `${value > 0 ? '+' : '-'}${formatRunwayDuration(Math.abs(value))}`
}
