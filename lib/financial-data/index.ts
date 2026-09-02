export {
  FINANCIAL_METRIC_KEYS,
  FINANCIAL_METRIC_LABELS,
  isFinancialMetricKey,
} from '@/lib/financial-data/metric-keys'
export {
  createUnavailableMetric,
  getMetricNumber,
  isAvailableMetric,
  isUnavailableMetric,
} from '@/lib/financial-data/metrics'
export {
  buildCalculatedRunwayMetric,
  buildWorkingCapitalAdjustedRunwayMetric,
  buildRunwayInputFromMetrics,
  buildUnavailableRunwayMetric,
  buildUnavailableWorkingCapitalAdjustedRunwayMetric,
  fillUnavailableMetrics,
  getSharedSupportedCurrency,
  summarizeMetricAvailability,
} from '@/lib/financial-data/read-model'
export {
  formatFinancialCurrency,
  isSupportedFinancialCurrency,
  SUPPORTED_FINANCIAL_CURRENCIES,
} from '@/lib/financial-data/currency'
export type { SupportedFinancialCurrency } from '@/lib/financial-data/currency'
export type { FinancialMetricKey } from '@/lib/financial-data/metric-keys'
export type {
  CompleteFinancialMetricSet,
  SourceAwareMetricReadResult,
} from '@/lib/financial-data/read-model'
export type {
  AvailableFinancialMetricValue,
  FinancialMetricAvailabilityReason,
  FinancialMetricEvidence,
  FinancialMetricProvenance,
  FinancialMetricSet,
  FinancialMetricSourceType,
  FinancialMetricValue,
  UnavailableFinancialMetricValue,
} from '@/lib/financial-data/types'
export {
  HISTORICAL_METRIC_KEYS,
  METRIC_HISTORY_RECORD_LIMITS,
  readFinancialMetricHistory,
  readFinancialMetricHistorySeries,
  summarizeMetricHistory,
  summarizeMetricHistorySeries,
} from '@/lib/financial-data/metric-history'
export type {
  HistoricalMetricKey,
  MetricHistoryDirection,
  MetricHistoryPoint,
  MetricHistoryRange,
  MetricHistoryRecordLimit,
  MetricHistorySeriesCollection,
  MetricHistorySourceOption,
  MetricHistorySummary,
} from '@/lib/financial-data/metric-history'
export {
  FORECAST_HORIZONS,
  isForecastHorizon,
  readFinancialMetricForecast,
  readFinancialMetricForecastSeries,
  summarizeMetricForecast,
  summarizeMetricForecastSeries,
} from '@/lib/financial-data/metric-forecast'
export { backtestMetricForecasts } from '@/lib/financial-data/forecast-backtest'
export type {
  ForecastBacktestPoint,
  ForecastBacktestSeries,
} from '@/lib/financial-data/forecast-backtest'
export type {
  ForecastHorizon,
  MetricForecastPoint,
  MetricForecastSeriesCollection,
  MetricForecastSummary,
} from '@/lib/financial-data/metric-forecast'
