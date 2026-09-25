import type { StatementLineKey } from '@/lib/company-analysis/statement-lines'
import type { CaseStudyCompany } from '@/lib/company-analysis/cima-case-studies'

/**
 * CIMA-style ratio analysis of a company's published annual statements.
 *
 * Pure calculation: no database and no AI. The model's job is to read these
 * results together and explain them; every number it reports comes from here.
 *
 * Basis: year-end balances rather than averages. Only two statements of
 * financial position are published, so averages would exist for one year only
 * and the two years would not be comparable.
 */

type CompanyLineKey = Exclude<StatementLineKey, 'segment_revenue' | 'segment_direct_costs'>

export interface RevenueStream {
  name: string
  revenue: number
  directCosts: number | null
}

export interface StatementYear {
  fiscalYearEnd: string
  lines: Partial<Record<CompanyLineKey, number>>
  streams: RevenueStream[]
}

export interface CompanyStatements {
  name: string
  currency: string
  amountsIn: 'units' | 'thousands' | 'millions'
  /** Latest year first. */
  years: StatementYear[]
}

export type RatioCategory =
  | 'profitability'
  | 'liquidity'
  | 'efficiency'
  | 'gearing'
  | 'cost_structure'
  | 'shareholder'

export type RatioUnit = '%' | 'x' | 'days' | 'ratio'

/**
 * Which way is better. Neutral ratios involve a trade-off (paying suppliers
 * later helps cash but strains the relationship), so the code does not pick a
 * winner and leaves the judgement to the explanation.
 */
export type RatioDirection = 'higher' | 'lower' | 'neutral'

export type RatioKey =
  | 'gross_margin'
  | 'margin_after_direct_costs'
  | 'operating_margin'
  | 'net_margin'
  | 'return_on_capital_employed'
  | 'return_on_equity'
  | 'current_ratio'
  | 'quick_ratio'
  | 'inventory_days'
  | 'receivable_days'
  | 'payable_days'
  | 'asset_turnover'
  | 'debt_to_equity'
  | 'gearing'
  | 'interest_cover'
  | 'marketing_to_revenue'
  | 'administration_to_revenue'
  | 'dividend_payout'

export interface StatementRatio {
  key: RatioKey
  label: string
  category: RatioCategory
  unit: RatioUnit
  direction: RatioDirection
  value: number
  /** The arithmetic with the actual figures, so a reader can check it. */
  working: string
}

export type TrendDirection = 'improved' | 'worsened' | 'unchanged' | 'not_comparable'

export interface RatioTrend {
  key: RatioKey
  label: string
  latest: number
  prior: number
  unit: RatioUnit
  change: number
  trend: TrendDirection
}

export interface GrowthMeasure {
  label: string
  latest: number
  prior: number
  /** Percentage change, or null when the prior value is zero. */
  growthPercent: number | null
}

export interface StreamAnalysis {
  name: string
  revenue: number
  shareOfRevenuePercent: number
  /** Null when the statements show no direct cost for the stream. */
  marginAfterDirectCostsPercent: number | null
  growthPercent: number | null
}

export interface YearAnalysis {
  fiscalYearEnd: string
  ratios: StatementRatio[]
  /** Ratios that could not be calculated and the lines they need. */
  unavailable: Array<{ key: RatioKey; label: string; missing: string[] }>
  streams: StreamAnalysis[]
}

export interface CompanyAnalysis {
  name: string
  currency: string
  amountsIn: CompanyStatements['amountsIn']
  latest: YearAnalysis
  prior: YearAnalysis | null
  growth: GrowthMeasure[]
  trends: RatioTrend[]
}

const DAYS_IN_YEAR = 365

function round(value: number, places: number) {
  const factor = 10 ** places
  return Math.round(value * factor) / factor
}

function placesFor(unit: RatioUnit) {
  return unit === 'days' ? 0 : unit === '%' ? 1 : 2
}

export function formatAmount(value: number, currency: string, amountsIn: CompanyStatements['amountsIn']) {
  const suffix = amountsIn === 'millions' ? 'm' : amountsIn === 'thousands' ? 'k' : ''
  return `${currency}${value.toFixed(1)}${suffix}`
}

export function formatRatioValue(value: number, unit: RatioUnit) {
  const text = value.toFixed(placesFor(unit))
  if (unit === '%') return `${text}%`
  if (unit === 'x') return `${text}x`
  if (unit === 'days') return `${text} days`
  return text
}

interface RatioSpec {
  key: RatioKey
  label: string
  category: RatioCategory
  unit: RatioUnit
  direction: RatioDirection
  /** Returns the value and its working, or the lines it is missing. */
  calculate: (
    year: StatementYear,
    fmt: (value: number) => string
  ) => { value: number; working: string } | { missing: string[] }
}

function totalDirectCosts(year: StatementYear) {
  const costs = year.streams.filter((stream) => stream.directCosts !== null)
  return costs.length === 0
    ? null
    : costs.reduce((sum, stream) => sum + (stream.directCosts ?? 0), 0)
}

/**
 * The cost base for inventory and payable days. Cost of sales where the
 * company reports it; otherwise the direct costs of its revenue streams.
 */
function costBase(year: StatementYear): { value: number; label: string } | null {
  if (year.lines.cost_of_sales !== undefined) {
    return { value: year.lines.cost_of_sales, label: 'cost of sales' }
  }
  const direct = totalDirectCosts(year)
  return direct === null ? null : { value: direct, label: 'direct costs' }
}

function need(year: StatementYear, keys: CompanyLineKey[]) {
  return keys.filter((key) => year.lines[key] === undefined)
}

function ratio(
  numerator: number,
  denominator: number,
  unit: RatioUnit
): number | null {
  if (denominator === 0) return null
  const raw = numerator / denominator
  return unit === '%' ? raw * 100 : unit === 'days' ? raw * DAYS_IN_YEAR : raw
}

const RATIOS: RatioSpec[] = [
  {
    key: 'gross_margin',
    label: 'Gross margin',
    category: 'profitability',
    unit: '%',
    direction: 'higher',
    calculate: (year, fmt) => {
      const missing = need(year, ['gross_profit', 'revenue'])
      if (missing.length) return { missing }
      const value = ratio(year.lines.gross_profit!, year.lines.revenue!, '%')
      if (value === null) return { missing: ['revenue'] }
      return {
        value,
        working: `Gross profit ${fmt(year.lines.gross_profit!)} ÷ revenue ${fmt(year.lines.revenue!)} × 100`,
      }
    },
  },
  {
    key: 'margin_after_direct_costs',
    label: 'Margin after direct costs',
    category: 'profitability',
    unit: '%',
    direction: 'higher',
    calculate: (year, fmt) => {
      // Only meaningful where the statements show direct costs by stream
      // instead of a single cost-of-sales line.
      if (year.lines.cost_of_sales !== undefined) return { missing: ['revenue streams with direct costs'] }
      const direct = totalDirectCosts(year)
      if (direct === null || year.lines.revenue === undefined) {
        return { missing: ['revenue streams with direct costs'] }
      }
      const value = ratio(year.lines.revenue - direct, year.lines.revenue, '%')
      if (value === null) return { missing: ['revenue'] }
      return {
        value,
        working: `(Revenue ${fmt(year.lines.revenue)} − direct costs ${fmt(direct)}) ÷ revenue ${fmt(year.lines.revenue)} × 100`,
      }
    },
  },
  {
    key: 'operating_margin',
    label: 'Operating margin',
    category: 'profitability',
    unit: '%',
    direction: 'higher',
    calculate: (year, fmt) => {
      const missing = need(year, ['operating_profit', 'revenue'])
      if (missing.length) return { missing }
      const value = ratio(year.lines.operating_profit!, year.lines.revenue!, '%')
      if (value === null) return { missing: ['revenue'] }
      return {
        value,
        working: `Operating profit ${fmt(year.lines.operating_profit!)} ÷ revenue ${fmt(year.lines.revenue!)} × 100`,
      }
    },
  },
  {
    key: 'net_margin',
    label: 'Net margin',
    category: 'profitability',
    unit: '%',
    direction: 'higher',
    calculate: (year, fmt) => {
      const missing = need(year, ['profit_for_year', 'revenue'])
      if (missing.length) return { missing }
      const value = ratio(year.lines.profit_for_year!, year.lines.revenue!, '%')
      if (value === null) return { missing: ['revenue'] }
      return {
        value,
        working: `Profit for the year ${fmt(year.lines.profit_for_year!)} ÷ revenue ${fmt(year.lines.revenue!)} × 100`,
      }
    },
  },
  {
    key: 'return_on_capital_employed',
    label: 'Return on capital employed',
    category: 'profitability',
    unit: '%',
    direction: 'higher',
    calculate: (year, fmt) => {
      const missing = need(year, ['operating_profit', 'total_equity', 'non_current_borrowings'])
      if (missing.length) return { missing }
      const capital = year.lines.total_equity! + year.lines.non_current_borrowings!
      const value = ratio(year.lines.operating_profit!, capital, '%')
      if (value === null) return { missing: ['capital employed'] }
      return {
        value,
        working: `Operating profit ${fmt(year.lines.operating_profit!)} ÷ capital employed (equity ${fmt(year.lines.total_equity!)} + non-current loans ${fmt(year.lines.non_current_borrowings!)}) × 100`,
      }
    },
  },
  {
    key: 'return_on_equity',
    label: 'Return on equity',
    category: 'profitability',
    unit: '%',
    direction: 'higher',
    calculate: (year, fmt) => {
      const missing = need(year, ['profit_for_year', 'total_equity'])
      if (missing.length) return { missing }
      const value = ratio(year.lines.profit_for_year!, year.lines.total_equity!, '%')
      if (value === null) return { missing: ['total equity'] }
      return {
        value,
        working: `Profit for the year ${fmt(year.lines.profit_for_year!)} ÷ equity ${fmt(year.lines.total_equity!)} × 100`,
      }
    },
  },
  {
    key: 'current_ratio',
    label: 'Current ratio',
    category: 'liquidity',
    unit: 'ratio',
    direction: 'higher',
    calculate: (year, fmt) => {
      const missing = need(year, ['current_assets', 'current_liabilities'])
      if (missing.length) return { missing }
      const value = ratio(year.lines.current_assets!, year.lines.current_liabilities!, 'ratio')
      if (value === null) return { missing: ['current liabilities'] }
      return {
        value,
        working: `Current assets ${fmt(year.lines.current_assets!)} ÷ current liabilities ${fmt(year.lines.current_liabilities!)}`,
      }
    },
  },
  {
    key: 'quick_ratio',
    label: 'Quick ratio',
    category: 'liquidity',
    unit: 'ratio',
    direction: 'higher',
    calculate: (year, fmt) => {
      const missing = need(year, ['current_assets', 'inventory', 'current_liabilities'])
      if (missing.length) return { missing }
      const value = ratio(
        year.lines.current_assets! - year.lines.inventory!,
        year.lines.current_liabilities!,
        'ratio'
      )
      if (value === null) return { missing: ['current liabilities'] }
      return {
        value,
        working: `(Current assets ${fmt(year.lines.current_assets!)} − inventory ${fmt(year.lines.inventory!)}) ÷ current liabilities ${fmt(year.lines.current_liabilities!)}`,
      }
    },
  },
  {
    key: 'inventory_days',
    label: 'Inventory days',
    category: 'efficiency',
    unit: 'days',
    direction: 'lower',
    calculate: (year, fmt) => {
      const base = costBase(year)
      const missing = [...need(year, ['inventory']), ...(base ? [] : ['cost of sales or direct costs'])]
      if (missing.length || !base) return { missing }
      const value = ratio(year.lines.inventory!, base.value, 'days')
      if (value === null) return { missing: [base.label] }
      return {
        value,
        working: `Inventory ${fmt(year.lines.inventory!)} ÷ ${base.label} ${fmt(base.value)} × ${DAYS_IN_YEAR}`,
      }
    },
  },
  {
    key: 'receivable_days',
    label: 'Receivable days',
    category: 'efficiency',
    unit: 'days',
    direction: 'lower',
    calculate: (year, fmt) => {
      const missing = need(year, ['trade_receivables', 'revenue'])
      if (missing.length) return { missing }
      const value = ratio(year.lines.trade_receivables!, year.lines.revenue!, 'days')
      if (value === null) return { missing: ['revenue'] }
      return {
        value,
        working: `Trade and other receivables ${fmt(year.lines.trade_receivables!)} ÷ revenue ${fmt(year.lines.revenue!)} × ${DAYS_IN_YEAR}`,
      }
    },
  },
  {
    key: 'payable_days',
    label: 'Payable days',
    category: 'efficiency',
    unit: 'days',
    direction: 'neutral',
    calculate: (year, fmt) => {
      const base = costBase(year)
      const missing = [...need(year, ['trade_payables']), ...(base ? [] : ['cost of sales or direct costs'])]
      if (missing.length || !base) return { missing }
      const value = ratio(year.lines.trade_payables!, base.value, 'days')
      if (value === null) return { missing: [base.label] }
      return {
        value,
        working: `Trade and other payables ${fmt(year.lines.trade_payables!)} ÷ ${base.label} ${fmt(base.value)} × ${DAYS_IN_YEAR}`,
      }
    },
  },
  {
    key: 'asset_turnover',
    label: 'Asset turnover',
    category: 'efficiency',
    unit: 'x',
    direction: 'higher',
    calculate: (year, fmt) => {
      const missing = need(year, ['revenue', 'total_assets'])
      if (missing.length) return { missing }
      const value = ratio(year.lines.revenue!, year.lines.total_assets!, 'x')
      if (value === null) return { missing: ['total assets'] }
      return {
        value,
        working: `Revenue ${fmt(year.lines.revenue!)} ÷ total assets ${fmt(year.lines.total_assets!)}`,
      }
    },
  },
  {
    key: 'debt_to_equity',
    label: 'Debt to equity',
    category: 'gearing',
    unit: 'ratio',
    direction: 'lower',
    calculate: (year, fmt) => {
      const missing = need(year, ['non_current_borrowings', 'total_equity'])
      if (missing.length) return { missing }
      const value = ratio(year.lines.non_current_borrowings!, year.lines.total_equity!, 'ratio')
      if (value === null) return { missing: ['total equity'] }
      return {
        value,
        working: `Non-current loans ${fmt(year.lines.non_current_borrowings!)} ÷ equity ${fmt(year.lines.total_equity!)}`,
      }
    },
  },
  {
    key: 'gearing',
    label: 'Gearing',
    category: 'gearing',
    unit: '%',
    direction: 'lower',
    calculate: (year, fmt) => {
      const missing = need(year, ['non_current_borrowings', 'total_equity'])
      if (missing.length) return { missing }
      const capital = year.lines.non_current_borrowings! + year.lines.total_equity!
      const value = ratio(year.lines.non_current_borrowings!, capital, '%')
      if (value === null) return { missing: ['capital employed'] }
      return {
        value,
        working: `Non-current loans ${fmt(year.lines.non_current_borrowings!)} ÷ (loans ${fmt(year.lines.non_current_borrowings!)} + equity ${fmt(year.lines.total_equity!)}) × 100`,
      }
    },
  },
  {
    key: 'interest_cover',
    label: 'Interest cover',
    category: 'gearing',
    unit: 'x',
    direction: 'higher',
    calculate: (year, fmt) => {
      const missing = need(year, ['operating_profit', 'finance_costs'])
      if (missing.length) return { missing }
      const value = ratio(year.lines.operating_profit!, year.lines.finance_costs!, 'x')
      if (value === null) return { missing: ['finance costs'] }
      return {
        value,
        working: `Operating profit ${fmt(year.lines.operating_profit!)} ÷ finance costs ${fmt(year.lines.finance_costs!)}`,
      }
    },
  },
  {
    key: 'marketing_to_revenue',
    label: 'Marketing as % of revenue',
    category: 'cost_structure',
    unit: '%',
    direction: 'neutral',
    calculate: (year, fmt) => {
      const missing = need(year, ['marketing_expenses', 'revenue'])
      if (missing.length) return { missing }
      const value = ratio(year.lines.marketing_expenses!, year.lines.revenue!, '%')
      if (value === null) return { missing: ['revenue'] }
      return {
        value,
        working: `Marketing ${fmt(year.lines.marketing_expenses!)} ÷ revenue ${fmt(year.lines.revenue!)} × 100`,
      }
    },
  },
  {
    key: 'administration_to_revenue',
    label: 'Administration as % of revenue',
    category: 'cost_structure',
    unit: '%',
    direction: 'lower',
    calculate: (year, fmt) => {
      const missing = need(year, ['administrative_expenses', 'revenue'])
      if (missing.length) return { missing }
      const value = ratio(year.lines.administrative_expenses!, year.lines.revenue!, '%')
      if (value === null) return { missing: ['revenue'] }
      return {
        value,
        working: `Administrative expenses ${fmt(year.lines.administrative_expenses!)} ÷ revenue ${fmt(year.lines.revenue!)} × 100`,
      }
    },
  },
  {
    key: 'dividend_payout',
    label: 'Dividend payout',
    category: 'shareholder',
    unit: '%',
    direction: 'neutral',
    calculate: (year, fmt) => {
      const missing = need(year, ['dividends', 'profit_for_year'])
      if (missing.length) return { missing }
      const value = ratio(year.lines.dividends!, year.lines.profit_for_year!, '%')
      if (value === null) return { missing: ['profit for the year'] }
      return {
        value,
        working: `Dividends ${fmt(year.lines.dividends!)} ÷ profit for the year ${fmt(year.lines.profit_for_year!)} × 100`,
      }
    },
  },
]

const RATIO_SPEC_BY_KEY = new Map(RATIOS.map((spec) => [spec.key, spec]))

function analyseYear(company: CompanyStatements, year: StatementYear, prior: StatementYear | undefined): YearAnalysis {
  const fmt = (value: number) => formatAmount(value, company.currency, company.amountsIn)
  const ratios: StatementRatio[] = []
  const unavailable: YearAnalysis['unavailable'] = []

  for (const spec of RATIOS) {
    const result = spec.calculate(year, fmt)
    if ('missing' in result) {
      // A company that reports cost of sales has no "margin after direct
      // costs", and vice versa. That is a different basis, not a gap.
      const differentBasis =
        (spec.key === 'margin_after_direct_costs' && year.lines.cost_of_sales !== undefined) ||
        (spec.key === 'gross_margin' && year.lines.cost_of_sales === undefined && year.streams.length > 0)
      if (!differentBasis) unavailable.push({ key: spec.key, label: spec.label, missing: result.missing })
      continue
    }
    const value = round(result.value, placesFor(spec.unit))
    ratios.push({
      key: spec.key,
      label: spec.label,
      category: spec.category,
      unit: spec.unit,
      direction: spec.direction,
      value,
      working: `${result.working} = ${formatRatioValue(value, spec.unit)}`,
    })
  }

  const revenue = year.lines.revenue
  const streams: StreamAnalysis[] =
    revenue === undefined || revenue === 0
      ? []
      : year.streams.map((stream) => {
          const previous = prior?.streams.find((candidate) => candidate.name === stream.name)
          return {
            name: stream.name,
            revenue: stream.revenue,
            shareOfRevenuePercent: round((stream.revenue / revenue) * 100, 1),
            marginAfterDirectCostsPercent:
              stream.directCosts === null || stream.revenue === 0
                ? null
                : round(((stream.revenue - stream.directCosts) / stream.revenue) * 100, 1),
            growthPercent:
              previous && previous.revenue !== 0
                ? round(((stream.revenue - previous.revenue) / previous.revenue) * 100, 1)
                : null,
          }
        })

  return { fiscalYearEnd: year.fiscalYearEnd, ratios, unavailable, streams }
}

function growth(label: string, latest: number | undefined, prior: number | undefined): GrowthMeasure[] {
  if (latest === undefined || prior === undefined) return []
  return [
    {
      label,
      latest,
      prior,
      growthPercent: prior === 0 ? null : round(((latest - prior) / Math.abs(prior)) * 100, 1),
    },
  ]
}

function trendOf(direction: RatioDirection, change: number): TrendDirection {
  if (change === 0) return 'unchanged'
  if (direction === 'neutral') return 'not_comparable'
  const better = direction === 'higher' ? change > 0 : change < 0
  return better ? 'improved' : 'worsened'
}

export function analyseCompany(company: CompanyStatements): CompanyAnalysis {
  const [latestYear, priorYear] = company.years
  if (!latestYear) throw new Error(`${company.name} has no statements to analyse.`)

  const latest = analyseYear(company, latestYear, priorYear)
  const prior = priorYear ? analyseYear(company, priorYear, company.years[2]) : null

  const trends: RatioTrend[] = prior
    ? latest.ratios.flatMap((current) => {
        const previous = prior.ratios.find((candidate) => candidate.key === current.key)
        if (!previous) return []
        const change = round(current.value - previous.value, placesFor(current.unit))
        return [
          {
            key: current.key,
            label: current.label,
            latest: current.value,
            prior: previous.value,
            unit: current.unit,
            change,
            trend: trendOf(current.direction, change),
          },
        ]
      })
    : []

  return {
    name: company.name,
    currency: company.currency,
    amountsIn: company.amountsIn,
    latest,
    prior,
    growth: [
      ...growth('Revenue', latestYear.lines.revenue, priorYear?.lines.revenue),
      ...growth('Operating profit', latestYear.lines.operating_profit, priorYear?.lines.operating_profit),
      ...growth('Profit for the year', latestYear.lines.profit_for_year, priorYear?.lines.profit_for_year),
    ],
    trends,
  }
}

export interface RatioComparison {
  key: RatioKey
  label: string
  category: RatioCategory
  unit: RatioUnit
  direction: RatioDirection
  first: number
  second: number
  difference: number
  /** Name of the stronger company, or null for neutral or equal ratios. */
  stronger: string | null
}

export interface CompanyComparison {
  first: CompanyAnalysis
  second: CompanyAnalysis
  ratios: RatioComparison[]
  growth: Array<{ label: string; first: number | null; second: number | null }>
  /**
   * Absolute sizes, only when both companies report in the same currency and
   * scale. Otherwise the reason amounts cannot be compared.
   */
  size:
    | { comparable: true; lines: Array<{ label: string; first: number; second: number }> }
    | { comparable: false; reason: string }
  /** Set when the latest years end on different dates. */
  periodNote: string | null
}

export function compareCompanies(first: CompanyStatements, second: CompanyStatements): CompanyComparison {
  const a = analyseCompany(first)
  const b = analyseCompany(second)

  const ratios: RatioComparison[] = a.latest.ratios.flatMap((mine) => {
    const theirs = b.latest.ratios.find((candidate) => candidate.key === mine.key)
    if (!theirs) return []
    const spec = RATIO_SPEC_BY_KEY.get(mine.key)!
    const difference = round(mine.value - theirs.value, placesFor(mine.unit))
    let stronger: string | null = null
    if (difference !== 0 && spec.direction !== 'neutral') {
      const firstBetter = spec.direction === 'higher' ? difference > 0 : difference < 0
      stronger = firstBetter ? first.name : second.name
    }
    return [
      {
        key: mine.key,
        label: mine.label,
        category: mine.category,
        unit: mine.unit,
        direction: mine.direction,
        first: mine.value,
        second: theirs.value,
        difference,
        stronger,
      },
    ]
  })

  const growthLabels = new Set([...a.growth, ...b.growth].map((measure) => measure.label))
  const growthRows = [...growthLabels].map((label) => ({
    label,
    first: a.growth.find((measure) => measure.label === label)?.growthPercent ?? null,
    second: b.growth.find((measure) => measure.label === label)?.growthPercent ?? null,
  }))

  const sameUnits = first.currency === second.currency && first.amountsIn === second.amountsIn
  const sizeKeys: Array<[CompanyLineKey, string]> = [
    ['revenue', 'Revenue'],
    ['operating_profit', 'Operating profit'],
    ['total_assets', 'Total assets'],
    ['total_equity', 'Equity'],
  ]
  const size: CompanyComparison['size'] = sameUnits
    ? {
        comparable: true,
        lines: sizeKeys.flatMap(([key, label]) => {
          const x = first.years[0]?.lines[key]
          const y = second.years[0]?.lines[key]
          return x === undefined || y === undefined ? [] : [{ label, first: x, second: y }]
        }),
      }
    : {
        comparable: false,
        reason: `${first.name} reports in ${first.currency} ${first.amountsIn} and ${second.name} in ${second.currency} ${second.amountsIn}, so amounts are not comparable; only ratios are.`,
      }

  const firstEnd = first.years[0]?.fiscalYearEnd
  const secondEnd = second.years[0]?.fiscalYearEnd
  const periodNote =
    firstEnd && secondEnd && firstEnd !== secondEnd
      ? `The latest years end on different dates (${first.name}: ${firstEnd}; ${second.name}: ${secondEnd}).`
      : null

  return { first: a, second: b, ratios, growth: growthRows, size, periodNote }
}

/** Builds analysis input from the typed case-study seed data. */
export function statementsFromCaseStudy(company: CaseStudyCompany): CompanyStatements {
  return {
    name: company.name,
    currency: company.currency,
    amountsIn: company.amountsIn,
    years: company.years.map((year) => ({
      fiscalYearEnd: year.fiscalYearEnd,
      lines: { ...year.lines },
      streams: (year.revenueStreams ?? []).map((stream) => ({ ...stream })),
    })),
  }
}

/** Builds analysis input from company_statement_lines rows, latest year first. */
export function statementsFromLines(
  company: { name: string; currency: string; amountsIn: CompanyStatements['amountsIn'] },
  rows: Array<{ fiscal_year_end: string; line_key: StatementLineKey; segment: string; value: number }>
): CompanyStatements {
  const years = new Map<string, StatementYear>()

  for (const row of rows) {
    const year =
      years.get(row.fiscal_year_end) ??
      { fiscalYearEnd: row.fiscal_year_end, lines: {}, streams: [] }
    years.set(row.fiscal_year_end, year)
    const value = Number(row.value)

    if (row.line_key === 'segment_revenue' || row.line_key === 'segment_direct_costs') {
      let stream = year.streams.find((candidate) => candidate.name === row.segment)
      if (!stream) {
        stream = { name: row.segment, revenue: 0, directCosts: null }
        year.streams.push(stream)
      }
      if (row.line_key === 'segment_revenue') stream.revenue = value
      else stream.directCosts = value
      continue
    }

    year.lines[row.line_key] = value
  }

  return {
    name: company.name,
    currency: company.currency,
    amountsIn: company.amountsIn,
    years: [...years.values()].sort((x, y) => y.fiscalYearEnd.localeCompare(x.fiscalYearEnd)),
  }
}
