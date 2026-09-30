import type { FinancialRevenueDimensionType } from '@/types/database'
import type { RevenueEntryWithDetails, Stage3FinancialData } from './types'

export interface RevenueAnalyticsPeriod {
  periodStart: string
  periodEnd: string
  label: string
}

function round(value: number, precision = 2) {
  return Number(value.toFixed(precision))
}

function monthStart(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)).toISOString().slice(0, 10)
}

function shiftedMonthStart(date: Date, monthsBack: number) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - monthsBack, 1)).toISOString().slice(0, 10)
}

export function resolveRevenueAnalyticsPeriod(userMessage: string, asOfDate: string): RevenueAnalyticsPeriod {
  const date = new Date(`${asOfDate}T00:00:00.000Z`)
  const message = userMessage.toLowerCase()
  if (/\bthis month\b|\bcurrent month\b/.test(message)) {
    return { periodStart: monthStart(date), periodEnd: asOfDate, label: 'This month' }
  }
  if (/\bthis quarter\b|\bcurrent quarter\b/.test(message)) {
    const quarterMonth = Math.floor(date.getUTCMonth() / 3) * 3
    return {
      periodStart: new Date(Date.UTC(date.getUTCFullYear(), quarterMonth, 1)).toISOString().slice(0, 10),
      periodEnd: asOfDate,
      label: 'This quarter',
    }
  }
  if (/\bthis year\b|\bcurrent year\b|\byear to date\b|\bytd\b/.test(message)) {
    return { periodStart: `${date.getUTCFullYear()}-01-01`, periodEnd: asOfDate, label: 'Year to date' }
  }
  const monthMatch = message.match(/\b(?:last|past)\s+(3|6|12)\s+months?\b/)
  const months = monthMatch ? Number(monthMatch[1]) : 12
  return {
    periodStart: shiftedMonthStart(date, months - 1),
    periodEnd: asOfDate,
    label: `Last ${months} months`,
  }
}

function entriesForPeriod(data: Stage3FinancialData, period: RevenueAnalyticsPeriod) {
  return data.revenueEntries.filter((entry) =>
    entry.status === 'posted' && entry.revenue_date >= period.periodStart && entry.revenue_date <= period.periodEnd
  )
}

function sourceGroups(entries: RevenueEntryWithDetails[]) {
  const groups = new Map<string, RevenueEntryWithDetails[]>()
  for (const entry of entries) {
    const key = `${entry.source_label}\u0000${entry.currency}`
    const group = groups.get(key) ?? []
    group.push(entry)
    groups.set(key, group)
  }
  return [...groups.values()]
}

export function summarizeCustomerRevenue(data: Stage3FinancialData, period: RevenueAnalyticsPeriod) {
  return sourceGroups(entriesForPeriod(data, period)).map((entries) => {
    const customerTotals = new Map<string, { customerId: string; customerName: string; revenue: number }>()
    let unallocatedRevenue = 0
    for (const entry of entries) {
      if (!entry.customer) {
        unallocatedRevenue += Number(entry.amount)
        continue
      }
      const item = customerTotals.get(entry.customer.id) ?? {
        customerId: entry.customer.id,
        customerName: entry.customer.customer_name,
        revenue: 0,
      }
      item.revenue += Number(entry.amount)
      customerTotals.set(entry.customer.id, item)
    }
    const totalRevenue = entries.reduce((sum, entry) => sum + Number(entry.amount), 0)
    const items = [...customerTotals.values()]
      .map((item) => ({
        ...item,
        revenue: round(item.revenue),
        percentage: totalRevenue > 0 ? round((item.revenue / totalRevenue) * 100, 1) : null,
      }))
      .sort((left, right) => right.revenue - left.revenue)
    return {
      sourceLabel: entries[0].source_label,
      currency: entries[0].currency,
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
      periodLabel: period.label,
      totalRevenue: round(totalRevenue),
      allocatedRevenue: round(totalRevenue - unallocatedRevenue),
      unallocatedRevenue: round(unallocatedRevenue),
      rankingMethod: 'Net recorded revenue, highest to lowest',
      items,
    }
  })
}

export function summarizeCustomerConcentration(data: Stage3FinancialData, period: RevenueAnalyticsPeriod) {
  return summarizeCustomerRevenue(data, period).map((group) => {
    const hasNegativeCustomerRevenue = group.items.some((item) => item.revenue < 0) || group.unallocatedRevenue < 0
    const status = group.totalRevenue <= 0
      ? 'unavailable_non_positive_revenue' as const
      : hasNegativeCustomerRevenue
        ? 'unavailable_negative_customer_revenue' as const
        : group.allocatedRevenue <= 0
          ? 'unavailable_no_customer_mapping' as const
        : group.unallocatedRevenue > 0
          ? 'partial_unallocated' as const
          : 'ready' as const
    const concentration = (count: number) => status.startsWith('unavailable')
      ? null
      : round((group.items.slice(0, count).reduce((sum, item) => sum + item.revenue, 0) / group.totalRevenue) * 100, 1)
    const topCustomerPercentage = concentration(1)
    const topThreePercentage = concentration(3)
    const topFivePercentage = concentration(5)
    const riskLevel = topCustomerPercentage === null || topThreePercentage === null
      ? 'unavailable' as const
      : topCustomerPercentage >= 50 || topThreePercentage >= 80
        ? 'high' as const
        : topCustomerPercentage >= 30 || topThreePercentage >= 60
          ? 'elevated' as const
          : 'diversified' as const
    return {
      ...group,
      status,
      riskLevel,
      topCustomerPercentage,
      topThreePercentage,
      topFivePercentage,
      thresholds: {
        elevated: 'Top customer ≥30% or top three ≥60%',
        high: 'Top customer ≥50% or top three ≥80%',
      },
    }
  })
}

export function summarizeRevenueByDimension(params: {
  data: Stage3FinancialData
  period: RevenueAnalyticsPeriod
  dimensionType: FinancialRevenueDimensionType
}) {
  const entries = entriesForPeriod(params.data, params.period)
  const axes = new Map<string, { sourceLabel: string; currency: string; dimensionGroup: string; entries: RevenueEntryWithDetails[] }>()
  for (const sourceEntries of sourceGroups(entries)) {
    const groups = new Set(sourceEntries.flatMap((entry) => entry.dimensions
      .filter((link) => link.dimension_type === params.dimensionType && link.dimension)
      .map((link) => link.dimension_group)))
    for (const dimensionGroup of groups) {
      const key = `${sourceEntries[0].source_label}\u0000${sourceEntries[0].currency}\u0000${dimensionGroup}`
      axes.set(key, {
        sourceLabel: sourceEntries[0].source_label,
        currency: sourceEntries[0].currency,
        dimensionGroup,
        entries: sourceEntries,
      })
    }
  }

  return [...axes.values()].map((axis) => {
    const totals = new Map<string, { dimensionId: string; name: string; revenue: number }>()
    let unallocatedRevenue = 0
    for (const entry of axis.entries) {
      const link = entry.dimensions.find((candidate) =>
        candidate.dimension_type === params.dimensionType &&
        candidate.dimension_group === axis.dimensionGroup &&
        candidate.dimension
      )
      if (!link?.dimension) {
        unallocatedRevenue += Number(entry.amount)
        continue
      }
      const item = totals.get(link.dimension.id) ?? {
        dimensionId: link.dimension.id,
        name: link.dimension.dimension_name,
        revenue: 0,
      }
      item.revenue += Number(entry.amount)
      totals.set(link.dimension.id, item)
    }
    const totalRevenue = axis.entries.reduce((sum, entry) => sum + Number(entry.amount), 0)
    return {
      sourceLabel: axis.sourceLabel,
      currency: axis.currency,
      periodStart: params.period.periodStart,
      periodEnd: params.period.periodEnd,
      periodLabel: params.period.label,
      dimensionType: params.dimensionType,
      dimensionGroup: axis.dimensionGroup,
      totalRevenue: round(totalRevenue),
      allocatedRevenue: round(totalRevenue - unallocatedRevenue),
      unallocatedRevenue: round(unallocatedRevenue),
      rankingMethod: 'Net recorded revenue, highest to lowest',
      items: [...totals.values()]
        .map((item) => ({
          ...item,
          revenue: round(item.revenue),
          percentage: totalRevenue > 0 ? round((item.revenue / totalRevenue) * 100, 1) : null,
        }))
        .sort((left, right) => right.revenue - left.revenue),
    }
  })
}
