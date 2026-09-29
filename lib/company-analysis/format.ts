import type { AnalysedCompany } from '@/types/database'
import {
  formatAmount,
  formatRatioValue,
  type CompanyAnalysis,
  type CompanyComparison,
  type RatioCategory,
  type RatioUnit,
  type TrendDirection,
} from '@/lib/company-analysis/statement-analysis'

const CATEGORY_ORDER: Array<[RatioCategory, string]> = [
  ['profitability', 'Profitability'],
  ['liquidity', 'Liquidity'],
  ['efficiency', 'Efficiency'],
  ['gearing', 'Gearing'],
  ['cost_structure', 'Cost structure'],
  ['shareholder', 'Shareholder returns'],
]

const TREND_TEXT: Record<TrendDirection, string> = {
  improved: 'improved',
  worsened: 'worsened',
  unchanged: 'unchanged',
  not_comparable: 'a trade-off, not judged better or worse',
}

/** [16, 17, 19] -> "16–17, 19" */
export function formatPages(pages: number[]) {
  const sorted = [...new Set(pages)].sort((a, b) => a - b)
  const ranges: string[] = []
  for (let i = 0; i < sorted.length; i++) {
    const start = sorted[i]
    let end = start
    while (sorted[i + 1] === end + 1) end = sorted[++i]
    ranges.push(start === end ? `${start}` : `${start}–${end}`)
  }
  return ranges.join(', ')
}

export interface CompanyContext {
  company: AnalysedCompany
  pages: number[]
}

function sourceLine({ company, pages }: CompanyContext) {
  return pages.length > 0
    ? `${company.source}, statement pages ${formatPages(pages)}`
    : company.source
}

function signedChange(value: number, unit: RatioUnit) {
  const places = unit === 'days' ? 0 : unit === '%' ? 1 : 2
  const suffix = unit === '%' ? ' points' : unit === 'days' ? ' days' : unit === 'x' ? 'x' : ''
  return `${value > 0 ? '+' : ''}${value.toFixed(places)}${suffix}`
}

function signed(value: number | null) {
  if (value === null) return 'not calculable (prior value is zero)'
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`
}

export function formatCompanyAnalysis(analysis: CompanyAnalysis, context: CompanyContext) {
  const { company } = context
  const money = (value: number) => formatAmount(value, analysis.currency, analysis.amountsIn)
  const lines: string[] = [
    `${company.name}${company.industry ? ` (${company.industry})` : ''}. Figures in ${analysis.currency} ${analysis.amountsIn}.`,
    `Source: ${sourceLine(context)}.`,
    analysis.prior
      ? `Latest financial year ended ${analysis.latest.fiscalYearEnd}, compared with the year ended ${analysis.prior.fiscalYearEnd}. Balance-sheet ratios use year-end figures.`
      : `Financial year ended ${analysis.latest.fiscalYearEnd}. No prior year is available, so there are no trends or growth figures.`,
  ]

  if (analysis.growth.length > 0) {
    lines.push('', 'Growth (year on year)')
    for (const measure of analysis.growth) {
      const change = measure.latest - measure.prior
      const changeText = `${change < 0 ? '-' : '+'}${money(Math.abs(change))}`
      lines.push(`- ${measure.label}: ${money(measure.prior)} → ${money(measure.latest)} (${changeText}, ${signed(measure.growthPercent)})`)
    }
  }

  for (const [category, heading] of CATEGORY_ORDER) {
    const ratios = analysis.latest.ratios.filter((ratio) => ratio.category === category)
    if (ratios.length === 0) continue
    lines.push('', heading)
    for (const ratio of ratios) {
      const trend = analysis.trends.find((candidate) => candidate.key === ratio.key)
      const comparison = trend
        ? ` (prior year ${formatRatioValue(trend.prior, trend.unit)}, ${signedChange(trend.change, trend.unit)}, ${TREND_TEXT[trend.trend]})`
        : analysis.prior
          ? ' (no prior-year figure)'
          : ''
      lines.push(`- ${ratio.label}: ${formatRatioValue(ratio.value, ratio.unit)}${comparison}`)
      lines.push(`  Working: ${ratio.working}`)
    }
  }

  if (analysis.latest.streams.length > 0) {
    lines.push('', 'Revenue streams (latest year)')
    for (const stream of analysis.latest.streams) {
      const margin =
        stream.marginAfterDirectCostsPercent === null
          ? 'no direct costs reported'
          : `margin after direct costs ${stream.marginAfterDirectCostsPercent.toFixed(1)}%`
      const growthText = stream.growthPercent === null ? 'no prior-year figure' : `growth ${signed(stream.growthPercent)}`
      lines.push(`- ${stream.name}: ${money(stream.revenue)}, ${stream.shareOfRevenuePercent.toFixed(1)}% of revenue, ${margin}, ${growthText}`)
    }
  }

  if (analysis.latest.unavailable.length > 0) {
    lines.push('', 'Not calculable for the latest year')
    for (const item of analysis.latest.unavailable) {
      lines.push(`- ${item.label}: needs ${item.missing.join(', ')}`)
    }
  }

  return lines.join('\n')
}

export function formatComparison(
  comparison: CompanyComparison,
  firstContext: CompanyContext,
  secondContext: CompanyContext
) {
  const { first, second } = comparison
  const a = first.name
  const b = second.name
  const lines: string[] = [
    `${a} compared with ${b}.`,
    `Latest financial years: ${a} ended ${first.latest.fiscalYearEnd}; ${b} ended ${second.latest.fiscalYearEnd}.`,
    `Sources: ${a}: ${sourceLine(firstContext)}. ${b}: ${sourceLine(secondContext)}.`,
    'Balance-sheet ratios use year-end figures.',
  ]
  if (comparison.periodNote) lines.push(comparison.periodNote)

  if (comparison.size.comparable) {
    lines.push('', `Size (both in ${first.currency} ${first.amountsIn})`)
    for (const row of comparison.size.lines) {
      lines.push(
        `- ${row.label}: ${a} ${formatAmount(row.first, first.currency, first.amountsIn)} | ${b} ${formatAmount(row.second, second.currency, second.amountsIn)}`
      )
    }
  } else {
    lines.push('', `Size not compared: ${comparison.size.reason}`)
  }

  if (comparison.growth.length > 0) {
    lines.push('', 'Growth (year on year)')
    for (const row of comparison.growth) {
      lines.push(`- ${row.label}: ${a} ${signed(row.first)} | ${b} ${signed(row.second)}`)
    }
  }

  for (const [category, heading] of CATEGORY_ORDER) {
    const rows = comparison.ratios.filter((row) => row.category === category)
    if (rows.length === 0) continue
    lines.push('', heading)
    for (const row of rows) {
      const verdict =
        row.direction === 'neutral'
          ? 'a trade-off, no winner'
          : row.stronger
            ? `stronger: ${row.stronger}`
            : 'level'
      lines.push(
        `- ${row.label}: ${a} ${formatRatioValue(row.first, row.unit)} | ${b} ${formatRatioValue(row.second, row.unit)} → ${verdict}`
      )
    }
  }

  // Ratios only one company has are on different bases (for example gross
  // margin versus margin after direct costs) and must not be set side by side.
  const compared = new Set(comparison.ratios.map((row) => row.key))
  const onlyOne = [
    ...first.latest.ratios.filter((ratio) => !compared.has(ratio.key)).map((ratio) => `${ratio.label} (${a} only)`),
    ...second.latest.ratios.filter((ratio) => !compared.has(ratio.key)).map((ratio) => `${ratio.label} (${b} only)`),
  ]
  if (onlyOne.length > 0) {
    lines.push('', `Not compared, because only one company reports it on this basis: ${onlyOne.join('; ')}.`)
  }

  const streamNames = [...new Set([...first.latest.streams, ...second.latest.streams].map((stream) => stream.name))]
  if (streamNames.length > 0) {
    lines.push('', 'Revenue streams (share of revenue, latest year)')
    for (const name of streamNames) {
      const x = first.latest.streams.find((stream) => stream.name === name)
      const y = second.latest.streams.find((stream) => stream.name === name)
      const describe = (stream: typeof x) =>
        stream ? `${stream.shareOfRevenuePercent.toFixed(1)}%` : 'none'
      lines.push(`- ${name}: ${a} ${describe(x)} | ${b} ${describe(y)}`)
    }
  }

  return lines.join('\n')
}
