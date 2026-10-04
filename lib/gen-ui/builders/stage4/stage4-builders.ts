import {
  summarizeInvoiceAgeing,
  summarizeOverdueInvoices,
  summarizeUpcomingInvoices,
} from '@/lib/financial-data/reporting/invoice-calculations'
import type { GenUiWidget, GenUiWidgetType } from '@/lib/gen-ui/types'
import { widgetId } from '../shared'
import type { GenUiDataContext, PlannerWidget } from '../types'

function title(spec: PlannerWidget, fallback: string) {
  return spec.title ?? fallback
}

function reason(spec: PlannerWidget, fallback: string) {
  return spec.reason ?? fallback
}

function unavailable<T extends GenUiWidget>(widget: T, message: string): T {
  return { ...widget, state: { status: 'unavailable', message } }
}

function currentDate() {
  return new Date().toISOString().slice(0, 10)
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00.000Z`).valueOf() + days * 86_400_000
  return new Date(value).toISOString().slice(0, 10)
}

function horizonDays(message: string): 7 | 14 | 30 {
  if (/\b(?:7\s*days?|1\s*weeks?)\b/i.test(message)) return 7
  if (/\b(?:14\s*days?|2\s*weeks?)\b/i.test(message)) return 14
  return 30
}

function limitGroupItems<T extends { items: unknown[] }>(groups: T[]): T[] {
  return groups.map((group) => ({ ...group, items: group.items.slice(0, 8) }))
}

export function buildOverdueInvoicesWidget(
  spec: PlannerWidget,
  index: number,
  context: GenUiDataContext,
): GenUiWidget {
  const asOfDate = currentDate()
  const allGroups = summarizeOverdueInvoices(context.stage3Data, asOfDate)
  const groups = limitGroupItems(allGroups)
  const widget: GenUiWidget = {
    id: widgetId('overdue_invoices', index),
    type: 'overdue_invoices',
    title: title(spec, 'Overdue invoices'),
    reason: reason(spec, 'This uses stored customer-invoice due dates and outstanding balances.'),
    data: {
      asOfDate,
      groups,
      note: groups.length > 0
        ? 'Only open customer invoices past their stored due date are included.'
        : 'No open customer invoices are past due as of this date.',
    },
  }
  return context.stage3Data.capabilities.includes('invoice_details')
    ? widget
    : unavailable(widget, 'Detailed customer invoices are required for overdue analysis.')
}

export function buildInvoiceAgeingWidget(
  spec: PlannerWidget,
  index: number,
  context: GenUiDataContext,
): GenUiWidget {
  const asOfDate = currentDate()
  const groups = summarizeInvoiceAgeing(context.stage3Data, asOfDate)
  const widget: GenUiWidget = {
    id: widgetId('invoice_ageing', index),
    type: 'invoice_ageing',
    title: title(spec, 'Invoice ageing'),
    reason: reason(spec, 'This ages open customer balances from each stored due date.'),
    data: {
      asOfDate,
      groups,
      note: groups.length > 0
        ? 'Buckets represent days overdue: 0–30, 31–60, 61–90, and more than 90 days.'
        : 'No overdue customer invoice balances are available for ageing.',
    },
  }
  return context.stage3Data.capabilities.includes('invoice_details')
    ? widget
    : unavailable(widget, 'Detailed customer invoices with due dates are required for ageing.')
}

export function buildExpectedPaymentsWidget(
  spec: PlannerWidget,
  index: number,
  context: GenUiDataContext,
): GenUiWidget {
  const asOfDate = currentDate()
  const horizon = horizonDays(context.userMessage)
  const groups = limitGroupItems(summarizeUpcomingInvoices({
    data: context.stage3Data,
    kind: 'sales_invoice',
    asOfDate,
    horizonDays: horizon,
  }))
  const widget: GenUiWidget = {
    id: widgetId('expected_payments', index),
    type: 'expected_payments',
    title: title(spec, `Expected payments — next ${horizon} days`),
    reason: reason(spec, 'This schedules open customer balances by their recorded invoice due dates.'),
    data: {
      asOfDate,
      throughDate: addDays(asOfDate, horizon),
      horizonDays: horizon,
      groups,
      method: 'Open customer invoice outstanding balance grouped by stored due date',
      note: groups.length > 0
        ? 'Due dates indicate when payment is expected; they do not guarantee receipt.'
        : `No open customer invoices are due during the next ${horizon} days.`,
    },
  }
  return context.stage3Data.capabilities.includes('invoice_details')
    ? widget
    : unavailable(widget, 'Detailed customer invoices are required to schedule expected payments.')
}

export function buildBillsDueWidget(
  spec: PlannerWidget,
  index: number,
  context: GenUiDataContext,
): GenUiWidget {
  const asOfDate = currentDate()
  const horizon = horizonDays(context.userMessage)
  const groups = limitGroupItems(summarizeUpcomingInvoices({
    data: context.stage3Data,
    kind: 'supplier_bill',
    asOfDate,
    horizonDays: horizon,
  }))
  const widget: GenUiWidget = {
    id: widgetId('bills_due', index),
    type: 'bills_due',
    title: title(spec, `Bills due — next ${horizon} days`),
    reason: reason(spec, 'This schedules open supplier balances by their recorded bill due dates.'),
    data: {
      asOfDate,
      throughDate: addDays(asOfDate, horizon),
      horizonDays: horizon,
      groups,
      note: groups.length > 0
        ? 'Only open supplier bills due inside the displayed window are included.'
        : `No open supplier bills are due during the next ${horizon} days.`,
    },
  }
  return context.stage3Data.capabilities.includes('bill_details')
    ? widget
    : unavailable(widget, 'Detailed supplier bills are required to show upcoming bills.')
}

export const STAGE4_WIDGET_TYPES: GenUiWidgetType[] = [
  'overdue_invoices',
  'invoice_ageing',
  'expected_payments',
  'bills_due',
]
