import { ApiError } from '@/lib/api/errors'
import {
  calculateAnalysisRunway,
  calculateOperatingBalance,
  calculateReceivablesPayablesPosition,
  classifyFinancialAnalysisReadiness,
} from '@/lib/financial-analysis/calculations'
import type {
  DeterministicFinancialFacts,
  FinancialAnalysisEvidence,
  FinancialAnalysisPeriodComparison,
  FinancialAnalysisReadiness,
  FinancialAnalysisSelectedSource,
  FinancialAnalysisSectionAvailability,
} from '@/lib/financial-analysis/types'
import { mapObservationRowToMetric } from '@/lib/financial-data/observation-mapping'
import { selectLatestFinancialMetricObservations } from '@/lib/financial-data/latest-observation'
import {
  FINANCIAL_METRIC_KEYS,
  type FinancialMetricKey,
} from '@/lib/financial-data/metric-keys'
import { summarizeMetricForecast } from '@/lib/financial-data/metric-forecast'
import { summarizeMetricHistory } from '@/lib/financial-data/metric-history'
import { getFinancialObservationSourceKey } from '@/lib/financial-data/source-key'
import {
  FinancialAnalysisRequestSchema,
  financialAnalysisEffectiveDate,
  resolveFinancialAnalysisTimeline,
  type FinancialAnalysisRequest,
} from '@/lib/financial-analysis/timeline'
import type { FinancialMetricObservation } from '@/types/database'

export { FinancialAnalysisRequestSchema }
export type { FinancialAnalysisRequest }

export interface FinancialAnalysisCollection {
  selection: {
    mode: 'single' | 'timeline'
    sourceKey: string
    sourceLabel: string
    sourceKeys: string[]
    sources: FinancialAnalysisSelectedSource[]
    currency: 'NZD' | 'AUD'
    reportingPeriodStart: string
    reportingPeriodEnd: string
    reportDate: string
  }
  readiness: FinancialAnalysisReadiness
  sections: FinancialAnalysisSectionAvailability[]
  facts: DeterministicFinancialFacts
  evidence: FinancialAnalysisEvidence[]
  assumptions: string[]
  baselineFingerprint: Array<{ id: string; updatedAt: string }>
}

const HISTORY_METRIC_KEYS = [
  'cash',
  'monthly_revenue',
  'monthly_expenses',
  'burn_rate',
] as const satisfies readonly FinancialMetricKey[]

const effectiveDate = financialAnalysisEffectiveDate

function sameReportingDate(
  rows: Array<FinancialMetricObservation | undefined>
) {
  return rows.every(Boolean) &&
    new Set(rows.map((row) => effectiveDate(row as FinancialMetricObservation))).size === 1
}

function sixMonthRows(
  rows: FinancialMetricObservation[],
  reportDate?: string
) {
  if (rows.length === 0) return []
  const latestByDate = new Map<string, FinancialMetricObservation>()

  for (const row of rows) {
    const date = effectiveDate(row)
    const existing = latestByDate.get(date)
    if (!existing || row.updated_at > existing.updated_at) {
      latestByDate.set(date, row)
    }
  }

  const ordered = [...latestByDate.values()].sort((left, right) =>
    effectiveDate(left).localeCompare(effectiveDate(right))
  )
  const latestDate = new Date(`${reportDate ?? effectiveDate(ordered.at(-1) as FinancialMetricObservation)}T00:00:00.000Z`)
  const cutoff = new Date(latestDate)
  cutoff.setUTCMonth(cutoff.getUTCMonth() - 6)

  return ordered
    .filter((row) => {
      const date = new Date(`${effectiveDate(row)}T00:00:00.000Z`)
      return date >= cutoff && date <= latestDate
    })
    .slice(-12)
}

function finiteOrNull(value: number | null) {
  return value !== null && Number.isFinite(value) ? value : null
}

function buildHistoryFacts(
  rows: FinancialMetricObservation[],
  reportDate?: string
) {
  return HISTORY_METRIC_KEYS.flatMap((metricKey) => {
    const metricRows = sixMonthRows(
      rows.filter((row) => row.metric_key === metricKey),
      reportDate
    )
    if (metricRows.length === 0) return []
    const summary = summarizeMetricHistory({
      metricKey,
      range: '6m',
      recordLimit: 12,
      observations: metricRows.map(mapObservationRowToMetric),
    })

    return [{
      metricKey,
      direction: summary.direction,
      observationCount: summary.points.length,
      firstValue: summary.firstValue,
      latestValue: summary.latestValue,
      absoluteChange: summary.totalChange,
      percentageChange: finiteOrNull(summary.percentageChange),
      values: summary.points.map((point) => ({
        date: point.date,
        value: point.value,
      })),
    }]
  })
}

function buildForecastFacts(
  rows: FinancialMetricObservation[],
  reportDate?: string
) {
  return HISTORY_METRIC_KEYS.flatMap((metricKey) => {
    const metricRows = sixMonthRows(
      rows.filter((row) => row.metric_key === metricKey),
      reportDate
    )
    const forecast = summarizeMetricForecast({
      metricKey,
      range: '6m',
      horizon: 6,
      recordLimit: 12,
      observations: metricRows.map(mapObservationRowToMetric),
    })
    if (forecast.monthlySlope === null || forecast.forecastPoints.length !== 6) {
      return []
    }

    return [{
      metricKey,
      method: 'date_aware_linear_trend' as const,
      monthlySlope: forecast.monthlySlope,
      values: forecast.forecastPoints.map((point) => ({
        month: point.date.slice(0, 7),
        value: point.value,
      })),
    }]
  })
}

function collectUsedRows(
  rows: FinancialMetricObservation[],
  reportDate?: string
) {
  return FINANCIAL_METRIC_KEYS.flatMap((metricKey) =>
    sixMonthRows(rows.filter((row) => row.metric_key === metricKey), reportDate)
  ).sort((left, right) =>
    left.metric_key.localeCompare(right.metric_key) ||
    effectiveDate(left).localeCompare(effectiveDate(right)) ||
    left.id.localeCompare(right.id)
  )
}

function periodChange(first: number, last: number) {
  const absolute = Number((last - first).toFixed(2))
  return {
    absolute,
    percentage: first === 0
      ? null
      : Number(((absolute / Math.abs(first)) * 100).toFixed(2)),
  }
}

function comparison(
  metricKey: FinancialAnalysisPeriodComparison['metricKey'],
  points: Array<{ reportingDate: string; value: number }>,
  reportDate: string
): FinancialAnalysisPeriodComparison {
  const ordered = [...points].sort((left, right) =>
    left.reportingDate.localeCompare(right.reportingDate)
  )
  const latest = ordered.find((point) => point.reportingDate === reportDate) ?? null
  const beforeLatest = ordered.filter((point) => point.reportingDate < reportDate)
  const earliest = ordered[0] ?? null
  const previous = beforeLatest.at(-1) ?? null
  const startToLatestChange = earliest && latest && earliest.reportingDate !== latest.reportingDate
    ? periodChange(earliest.value, latest.value)
    : null
  const previousToLatestChange = previous && latest
    ? periodChange(previous.value, latest.value)
    : null

  return {
    metricKey,
    earliest,
    previous,
    latest,
    startToLatestChange,
    previousToLatestChange,
    unavailableReason: latest === null
      ? 'No compatible value is available on the latest selected reporting date.'
      : previous === null
        ? 'At least two compatible reporting periods are required for comparison.'
        : null,
  }
}

function buildPeriodComparisons(
  rows: FinancialMetricObservation[],
  reportDate: string
) {
  const rawMetricKeys = [
    'cash',
    'monthly_revenue',
    'monthly_expenses',
    'burn_rate',
    'accounts_receivable',
    'accounts_payable',
  ] as const satisfies readonly FinancialMetricKey[]
  const rawComparisons = rawMetricKeys.map((metricKey) => comparison(
    metricKey,
    sixMonthRows(
      rows.filter((row) => row.metric_key === metricKey),
      reportDate
    ).map((row) => ({
      reportingDate: effectiveDate(row),
      value: row.value,
    })),
    reportDate
  ))
  const rowsByDate = new Map<string, Map<FinancialMetricKey, FinancialMetricObservation>>()
  for (const row of rows) {
    const date = effectiveDate(row)
    const dateRows = rowsByDate.get(date) ?? new Map()
    dateRows.set(row.metric_key, row)
    rowsByDate.set(date, dateRows)
  }
  const cashRunwayPoints: Array<{ reportingDate: string; value: number }> = []
  const adjustedRunwayPoints: Array<{ reportingDate: string; value: number }> = []
  for (const [reportingDate, dateRows] of rowsByDate) {
    const cash = dateRows.get('cash')
    const burn = dateRows.get('burn_rate')
    if (!cash || !burn || burn.value <= 0) continue
    const receivables = dateRows.get('accounts_receivable')
    const payables = dateRows.get('accounts_payable')
    const runway = calculateAnalysisRunway({
      cash: cash.value,
      monthlyBurnRate: burn.value,
      accountsReceivable: receivables && payables ? receivables.value : null,
      accountsPayable: receivables && payables ? payables.value : null,
    })
    cashRunwayPoints.push({
      reportingDate,
      value: runway.cashRunwayMonths,
    })
    if (runway.workingCapitalAdjustedRunwayMonths !== null) {
      adjustedRunwayPoints.push({
        reportingDate,
        value: runway.workingCapitalAdjustedRunwayMonths,
      })
    }
  }

  return [
    ...rawComparisons,
    comparison('cash_runway_months', cashRunwayPoints, reportDate),
    comparison(
      'working_capital_adjusted_runway_months',
      adjustedRunwayPoints,
      reportDate
    ),
  ]
}

function sourceFromRow(
  sourceKey: string,
  row: FinancialMetricObservation
): FinancialAnalysisSelectedSource {
  return {
    sourceKey,
    sourceLabel: row.source_label,
    sourceType: row.source_type,
    documentId: row.document_id,
    connectionId: row.connection_id,
  }
}

function evidenceFromRow(params: {
  row: FinancialMetricObservation
  currency: 'NZD' | 'AUD'
  usedInCalculations?: boolean
  resolution?: FinancialAnalysisEvidence['resolution']
}): FinancialAnalysisEvidence {
  return {
    observationId: params.row.id,
    metricKey: params.row.metric_key,
    value: params.row.value,
    currency: params.currency,
    reportingDate: effectiveDate(params.row),
    sourceLabel: params.row.source_label,
    sourceType: params.row.source_type,
    sourceKey: getFinancialObservationSourceKey(params.row),
    documentId: params.row.document_id,
    connectionId: params.row.connection_id,
    confidence: params.row.confidence,
    usedInCalculations: params.usedInCalculations ?? true,
    resolution: params.resolution ?? 'uncontested',
  }
}

export function collectFinancialAnalysisFromObservations(params: {
  request: unknown
  observations: FinancialMetricObservation[]
}): FinancialAnalysisCollection {
  const request = FinancialAnalysisRequestSchema.parse(params.request)
  const timeline = request.mode === 'timeline'
    ? resolveFinancialAnalysisTimeline({ request, observations: params.observations })
    : null
  const selectedRows = timeline
    ? timeline.selectedRows
    : params.observations.filter((row) =>
        getFinancialObservationSourceKey(row) === request.sourceKeys[0] &&
        row.currency === request.currency &&
        row.metric_key !== 'runway_months'
      )

  if (selectedRows.length === 0) {
    throw new ApiError(
      400,
      'BAD_REQUEST',
      'The selected source and currency are unavailable or do not belong to this user.'
    )
  }

  const allSelectedDates = selectedRows.map(effectiveDate).sort()
  const reportDate = timeline?.reportDate ?? allSelectedDates.at(-1) as string
  const calculationRows = timeline?.calculationRows ?? collectUsedRows(
    selectedRows,
    reportDate
  )
  const latestRows = timeline
    ? calculationRows.filter((row) => effectiveDate(row) === reportDate)
    : selectLatestFinancialMetricObservations(selectedRows)
  const latest = new Map(latestRows.map((row) => [row.metric_key, row]))
  const cash = latest.get('cash')
  const receivables = latest.get('accounts_receivable')
  const payables = latest.get('accounts_payable')
  const burn = latest.get('burn_rate')
  const revenue = latest.get('monthly_revenue')
  const expenses = latest.get('monthly_expenses')
  const cashRunwayCompatible = sameReportingDate([cash, burn])
  const adjustedRunwayCompatible = sameReportingDate([
    cash,
    receivables,
    payables,
    burn,
  ])
  const operatingBalanceCompatible = sameReportingDate([revenue, expenses])
  const workingCapitalCompatible = sameReportingDate([receivables, payables])
  const runway = cashRunwayCompatible && cash && burn
    ? calculateAnalysisRunway({
        cash: cash.value,
        monthlyBurnRate: burn.value,
        accountsReceivable: adjustedRunwayCompatible ? receivables?.value : null,
        accountsPayable: adjustedRunwayCompatible ? payables?.value : null,
      })
    : null
  const operatingBalance = operatingBalanceCompatible && revenue && expenses
    ? calculateOperatingBalance({
        monthlyRevenue: revenue.value,
        monthlyExpenses: expenses.value,
      })
    : null
  const receivablesPayables = workingCapitalCompatible && receivables && payables
    ? calculateReceivablesPayablesPosition({
        accountsReceivable: receivables.value,
        accountsPayable: payables.value,
      })
    : null
  const history = buildHistoryFacts(calculationRows, reportDate)
  const forecasts = buildForecastFacts(calculationRows, reportDate)
  const availableMetricKeys = [
    ...new Set([
      ...latestRows.map((row) => row.metric_key),
      ...(runway ? ['runway_months' as const] : []),
    ]),
  ]
  const incompatibleSections = timeline ? [] : [
    ...(cash && burn && !cashRunwayCompatible ? ['current_runway' as const] : []),
    ...(cash && receivables && payables && burn && !adjustedRunwayCompatible
      ? ['working_capital_adjusted_runway' as const]
      : []),
    ...(revenue && expenses && !operatingBalanceCompatible
      ? ['operating_balance' as const]
      : []),
    ...(receivables && payables && !workingCapitalCompatible
      ? ['working_capital' as const]
      : []),
  ]
  const cashHistoryCount = history.find((fact) => fact.metricKey === 'cash')
    ?.observationCount ?? 0
  const readiness = classifyFinancialAnalysisReadiness({
    availableMetricKeys,
    historicalObservationCount: cashHistoryCount,
    sourceSelectionRequired: true,
    sourceSelected: true,
    currencySelectionRequired: true,
    currencySelected: true,
    incompatibleSections,
  })
  const evidenceRows = timeline?.selectedRows ?? calculationRows
  const evidence = evidenceRows.map((row) => {
    const resolution = timeline?.evidenceResolutionById.get(row.id)
    return evidenceFromRow({
      row,
      currency: request.currency,
      usedInCalculations: resolution?.usedInCalculations,
      resolution: resolution?.resolution,
    })
  })
  const sources = timeline?.selectedSources ?? [
    sourceFromRow(request.sourceKeys[0], selectedRows[0]),
  ]
  const reportingDates = [...new Set(evidence.map((item) => item.reportingDate))].sort()
  const reportingPeriodStart = timeline?.reportingPeriodStart ??
    reportingDates[0] ?? reportDate
  const sourceLabel = request.mode === 'timeline'
    ? `${sources.length} selected statements`
    : sources[0].sourceLabel

  return {
    selection: {
      mode: request.mode,
      sourceKey: request.sourceKeys[0],
      sourceLabel,
      sourceKeys: request.sourceKeys,
      sources,
      currency: request.currency,
      reportingPeriodStart,
      reportingPeriodEnd: reportDate,
      reportDate,
    },
    readiness: readiness.readiness,
    sections: readiness.sections,
    facts: {
      operatingBalance,
      receivablesPayables,
      runway,
      history,
      forecasts,
      periodComparisons: buildPeriodComparisons(calculationRows, reportDate),
    },
    evidence,
    assumptions: [
      'Only reviewed observations from financial_metric_observations were used.',
      `The analysis keeps ${request.currency} separate and performs no currency conversion.`,
      `History uses the selected ${request.mode === 'timeline' ? 'sources' : 'source'} and currency over a fixed six-month view with at most 12 observations per metric.`,
      ...(timeline
        ? [
            'The latest selected reporting date defines current-period facts; missing metrics are not carried forward from older periods.',
            'Complementary same-date metrics are combined deterministically; conflicting values use the explicit user-selected observation.',
          ]
        : []),
      'Forecasts continue the observed date-aware linear trend for six months and are not guarantees.',
      'Operating balance is monthly revenue minus monthly expenses and is not presented as profit.',
      'Working-capital-adjusted runway assumes receivables are collected and payables are paid.',
    ],
    baselineFingerprint: evidenceRows.map((row) => ({
      id: row.id,
      updatedAt: row.updated_at,
    })),
  }
}

export async function collectFinancialAnalysis(params: {
  userId: string
  request: FinancialAnalysisRequest
}) {
  const { listFinancialMetricObservations } = await import(
    '@/lib/financial-data/persistence'
  )
  const observations = await listFinancialMetricObservations(params.userId)
  return collectFinancialAnalysisFromObservations({
    request: params.request,
    observations,
  })
}
