import type { FinancialMetricKey } from '@/lib/financial-data/metric-keys'

export type FinancialMetricSourceType =
  | 'xero'
  | 'quickbooks'
  | 'freshbooks'
  | 'myob'
  | 'document'
  | 'manual'
  | 'demo'

export type FinancialMetricAvailabilityReason =
  | 'not_connected'
  | 'not_extracted'
  | 'not_provided'
  | 'insufficient_data'
  | 'unsupported_source'

export interface FinancialMetricEvidence {
  documentId?: string
  documentChunkId?: string
  sourcePage?: number
  sourceRowStart?: number
  sourceRowEnd?: number
  sourceUrl?: string
  excerpt?: string
}

export interface FinancialMetricProvenance {
  sourceType: FinancialMetricSourceType
  sourceLabel: string
  sourceId?: string
  evidence?: FinancialMetricEvidence
}

export interface AvailableFinancialMetricValue {
  status: 'available'
  key: FinancialMetricKey
  value: number
  currency: string | null
  periodStart: string | null
  periodEnd: string | null
  asOfDate: string | null
  provenance: FinancialMetricProvenance
  confidence: number
  updatedAt: string
}

export interface UnavailableFinancialMetricValue {
  status: 'unavailable'
  key: FinancialMetricKey
  reason: FinancialMetricAvailabilityReason
  sourceType: FinancialMetricSourceType | null
  sourceLabel: string | null
  updatedAt: string | null
}

export type FinancialMetricValue =
  | AvailableFinancialMetricValue
  | UnavailableFinancialMetricValue

export type FinancialMetricSet = Partial<
  Record<FinancialMetricKey, FinancialMetricValue>
>
