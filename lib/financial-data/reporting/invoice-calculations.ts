import type {
  InvoiceAgeingBucket,
  InvoiceAgeingGroup,
  InvoiceBalanceGroup,
  InvoiceBalanceItem,
  InvoiceWithDetails,
  Stage3FinancialData,
} from './types'

const TERMINAL_STATUSES = new Set(['paid', 'voided', 'deleted'])
const DAY_MS = 86_400_000

function round(value: number, precision = 2) {
  return Number(value.toFixed(precision))
}

function dateValue(date: string) {
  return new Date(`${date}T00:00:00.000Z`).valueOf()
}

function daysBetween(later: string, earlier: string) {
  return Math.floor((dateValue(later) - dateValue(earlier)) / DAY_MS)
}

function addDays(date: string, days: number) {
  return new Date(dateValue(date) + days * DAY_MS).toISOString().slice(0, 10)
}

function openInvoices(data: Stage3FinancialData, kind: InvoiceWithDetails['invoice_kind']) {
  return data.invoices.filter((invoice) =>
    invoice.invoice_kind === kind &&
    Number(invoice.outstanding_amount) > 0 &&
    !TERMINAL_STATUSES.has(invoice.status)
  )
}

function toItem(invoice: InvoiceWithDetails, asOfDate: string): InvoiceBalanceItem {
  return {
    id: invoice.id,
    invoiceNumber: invoice.invoice_number,
    counterpartyName: invoice.counterparty_name,
    issueDate: invoice.issue_date,
    dueDate: invoice.due_date,
    outstandingAmount: round(Number(invoice.outstanding_amount)),
    daysOverdue: invoice.due_date < asOfDate
      ? daysBetween(asOfDate, invoice.due_date)
      : null,
  }
}

function groupBalances(invoices: InvoiceWithDetails[], asOfDate: string): InvoiceBalanceGroup[] {
  const groups = new Map<string, InvoiceBalanceGroup>()
  for (const invoice of invoices) {
    const key = `${invoice.source_label}\u0000${invoice.currency}`
    const group = groups.get(key) ?? {
      currency: invoice.currency,
      sourceLabel: invoice.source_label,
      count: 0,
      totalOutstanding: 0,
      items: [],
    }
    group.count += 1
    group.totalOutstanding += Number(invoice.outstanding_amount)
    group.items.push(toItem(invoice, asOfDate))
    groups.set(key, group)
  }
  return [...groups.values()]
    .map((group) => ({
      ...group,
      totalOutstanding: round(group.totalOutstanding),
      items: group.items.sort((left, right) => left.dueDate.localeCompare(right.dueDate)),
    }))
    .sort((left, right) => right.totalOutstanding - left.totalOutstanding)
}

export function summarizeOverdueInvoices(
  data: Stage3FinancialData,
  asOfDate: string,
): InvoiceBalanceGroup[] {
  return groupBalances(
    openInvoices(data, 'sales_invoice').filter((invoice) => invoice.due_date < asOfDate),
    asOfDate,
  ).map((group) => ({
    ...group,
    items: group.items.sort((left, right) =>
      (right.daysOverdue ?? 0) - (left.daysOverdue ?? 0)
    ),
  }))
}

function emptyAgeingBuckets(): InvoiceAgeingBucket[] {
  return [
    { key: 'days_0_30', label: '0–30 days', count: 0, amount: 0, percentage: 0 },
    { key: 'days_31_60', label: '31–60 days', count: 0, amount: 0, percentage: 0 },
    { key: 'days_61_90', label: '61–90 days', count: 0, amount: 0, percentage: 0 },
    { key: 'days_90_plus', label: '90+ days', count: 0, amount: 0, percentage: 0 },
  ]
}

function ageingBucketIndex(daysOverdue: number) {
  if (daysOverdue <= 30) return 0
  if (daysOverdue <= 60) return 1
  if (daysOverdue <= 90) return 2
  return 3
}

export function summarizeInvoiceAgeing(
  data: Stage3FinancialData,
  asOfDate: string,
): InvoiceAgeingGroup[] {
  return summarizeOverdueInvoices(data, asOfDate).map((group) => {
    const buckets = emptyAgeingBuckets()
    for (const invoice of group.items) {
      const bucket = buckets[ageingBucketIndex(invoice.daysOverdue ?? 0)]
      bucket.count += 1
      bucket.amount += invoice.outstandingAmount
    }
    return {
      currency: group.currency,
      sourceLabel: group.sourceLabel,
      totalOutstanding: group.totalOutstanding,
      buckets: buckets.map((bucket) => ({
        ...bucket,
        amount: round(bucket.amount),
        percentage: group.totalOutstanding === 0
          ? 0
          : round((bucket.amount / group.totalOutstanding) * 100, 1),
      })),
    }
  })
}

export function summarizeUpcomingInvoices(params: {
  data: Stage3FinancialData
  kind: 'sales_invoice' | 'supplier_bill'
  asOfDate: string
  horizonDays: 7 | 14 | 30
}): InvoiceBalanceGroup[] {
  const throughDate = addDays(params.asOfDate, params.horizonDays)
  return groupBalances(
    openInvoices(params.data, params.kind).filter((invoice) =>
      invoice.due_date >= params.asOfDate && invoice.due_date <= throughDate
    ),
    params.asOfDate,
  )
}
