export type YearEndResult = { ok: true; date: string } | { ok: false; message: string }

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function toIso(year: number, month: number, day: number): string | null {
  const date = new Date(Date.UTC(year, month - 1, day))
  const valid = date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  if (!valid) return null
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function fullYear(text: string) {
  const year = Number(text)
  return text.length === 2 ? 2000 + year : year
}

function monthFromName(text: string) {
  const index = MONTHS.indexOf(text.slice(0, 3).toLowerCase())
  const known = index >= 0 && (text.length === 3 || MONTH_NAMES[index].toLowerCase().startsWith(text.toLowerCase()))
  return known ? index + 1 : null
}

function notADate(heading: string): YearEndResult {
  return { ok: false, message: `The column heading "${heading}" isn't a date. Write it like 2025-03-31.` }
}

/**
 * ambiguous: 'refuse' (the default) asks the user to rewrite a date like
 * 3/4/2025; 'day-first' reads it the New Zealand way, as 3 April.
 */
export function parseYearEnd(heading: string, options: { ambiguous?: 'refuse' | 'day-first' } = {}): YearEndResult {
  const text = heading.trim()

  // 2025-03-31, the template's own format.
  const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (iso) {
    const date = toIso(Number(iso[1]), Number(iso[2]), Number(iso[3]))
    return date ? { ok: true, date } : notADate(heading)
  }

  // 31/03/2025 or 3/31/2025, also with - or . between the parts.
  const numeric = text.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}|\d{2})$/)
  if (numeric) {
    const first = Number(numeric[1])
    const second = Number(numeric[2])
    const year = fullYear(numeric[3])
    const dayFirst = toIso(year, second, first)
    const monthFirst = toIso(year, first, second)

    if (dayFirst && monthFirst && dayFirst !== monthFirst) {
      if (options.ambiguous === 'day-first') return { ok: true, date: dayFirst }
      return {
        ok: false,
        message:
          `The column heading "${heading}" could be ${first} ${MONTH_NAMES[second - 1]} or ` +
          `${second} ${MONTH_NAMES[first - 1]}. Write it like ${dayFirst} or ${monthFirst}.`,
      }
    }
    const date = dayFirst ?? monthFirst
    return date ? { ok: true, date } : notADate(heading)
  }

  // 31 Mar 2025, 31-Mar-25 or 31 March 2025.
  const dayName = text.match(/^(\d{1,2})[\s-]+([A-Za-z]+)[\s-]+(\d{4}|\d{2})$/)
  if (dayName) {
    const month = monthFromName(dayName[2])
    const date = month ? toIso(fullYear(dayName[3]), month, Number(dayName[1])) : null
    return date ? { ok: true, date } : notADate(heading)
  }

  // Mar 31, 2025 or March 31 2025.
  const nameDay = text.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/)
  if (nameDay) {
    const month = monthFromName(nameDay[1])
    const date = month ? toIso(Number(nameDay[3]), month, Number(nameDay[2])) : null
    return date ? { ok: true, date } : notADate(heading)
  }

  return notADate(heading)
}
