import type { FinancialMetricKey } from '@/lib/financial-data/metric-keys'
import type { ItemMatrixRow } from '@/lib/financial-data/item-matrix'
import { readExtractedItemsWithIndex } from '@/lib/financial-data/item-matrix'
import type { DocumentExtractionCandidateDraft } from '@/lib/documents/types'

export const ITEM_PROMOTION_EXTRACTOR_VERSION = 'user_item_promotion_v1'

export function selectStoredItemsForPromotion(
  metadata: unknown,
  itemIndexes: number[]
) {
  const indexedItems = new Map(
    readExtractedItemsWithIndex(metadata).map((item) => [item.index, item])
  )
  const items = [...itemIndexes]
    .sort((left, right) => left - right)
    .map((index) => indexedItems.get(index))

  return items.some((item) => !item)
    ? null
    : items.filter((item): item is ItemMatrixRow => Boolean(item))
}

export function hasPromotionSignature(
  candidates: Array<{ evidence: unknown }>,
  promotionSignature: string
) {
  return candidates.some(
    (candidate) =>
      candidate.evidence &&
      typeof candidate.evidence === 'object' &&
      !Array.isArray(candidate.evidence) &&
      Reflect.get(candidate.evidence, 'promotionSignature') === promotionSignature
  )
}

export function buildItemPromotionSignature(params: {
  itemIndexes: number[]
  metricKey: Exclude<FinancialMetricKey, 'runway_months'>
  currency: 'NZD' | 'AUD'
  reportingDate: string
}) {
  return JSON.stringify([
    [...params.itemIndexes].sort((left, right) => left - right),
    params.metricKey,
    params.currency,
    params.reportingDate,
  ])
}

export function buildPromotedItemsCandidate(params: {
  documentId: string
  items: ItemMatrixRow[]
  metricKey: Exclude<FinancialMetricKey, 'runway_months'>
  currency: 'NZD' | 'AUD'
  reportingDate: string
}) {
  const items = [...params.items].sort((left, right) => left.index - right.index)
  const itemIndexes = items.map((item) => item.index)
  const value = Math.round(
    (items.reduce((total, item) => total + item.value, 0) + Number.EPSILON) *
      100
  ) / 100
  const promotionSignature = buildItemPromotionSignature({
    itemIndexes,
    metricKey: params.metricKey,
    currency: params.currency,
    reportingDate: params.reportingDate,
  })

  return {
    value,
    promotionSignature,
    candidate: {
      originalPayload: {
        source: 'supplementary_items',
        itemIndexes,
        items: items.map(({ label, value: itemValue, attributes }) => ({
          label,
          value: itemValue,
          attributes,
        })),
        calculatedTotal: value,
      },
      metricKey: params.metricKey,
      value,
      currency: params.currency,
      reportingDate: params.reportingDate,
      confidence: 1,
      evidence: {
        documentId: params.documentId,
        extractionMethod: 'user_promoted_items',
        promotionSignature,
        itemIndexes,
        items: items.map(({ label, value: itemValue }) => ({
          label,
          value: itemValue,
        })),
        calculation: items.map((item) => item.value).join(' + '),
      },
      warnings: [],
      extractorVersion: ITEM_PROMOTION_EXTRACTOR_VERSION,
    } satisfies DocumentExtractionCandidateDraft,
  }
}
