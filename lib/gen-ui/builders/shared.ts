import { FINANCIAL_METRIC_KEYS } from "@/lib/financial-data/metric-keys";
import type { FinancialMetricKey } from "@/lib/financial-data/metric-keys";
import {
  formatFinancialCurrency,
  isSupportedFinancialCurrency,
} from "@/lib/financial-data/currency";
import { isAvailableMetric } from "@/lib/financial-data/metrics";
import type { SourceAwareMetricReadResult } from "@/lib/financial-data/read-model";
import type {
  GenUiMetricCalculationRole,
  GenUiMetricDateStatus,
  GenUiWidgetType,
} from "@/lib/gen-ui/types";
import type { GenUiDataContext } from "./types";

function metricReportingDate(
  metric: SourceAwareMetricReadResult["metrics"][FinancialMetricKey],
) {
  return isAvailableMetric(metric)
    ? metric.asOfDate ?? metric.periodEnd ?? metric.periodStart
    : null;
}

function runwayReferenceDate(snapshot: SourceAwareMetricReadResult) {
  return metricReportingDate(snapshot.metrics.runway_months)
    ?? metricReportingDate(snapshot.metrics.cash);
}

export function metricDisplayContext(params: {
  key: FinancialMetricKey;
  context: GenUiDataContext;
  adjustedRunway?: boolean;
}) {
  const metric = params.adjustedRunway
    ? params.context.snapshot.workingCapitalAdjustedRunway
    : params.context.snapshot.metrics[params.key];
  const runwayQuestion = /\brunway\b/i.test(params.context.userMessage);
  const referenceDate = runwayReferenceDate(params.context.snapshot);

  if (!isAvailableMetric(metric)) {
    return {
      reportingDate: params.adjustedRunway ? referenceDate : null,
      dateStatus: (params.adjustedRunway && referenceDate
        ? "unavailable_for"
        : "undated") as GenUiMetricDateStatus,
      calculationRole: "unavailable" as GenUiMetricCalculationRole,
      detail: metric.detail ?? metric.sourceLabel ?? "Unavailable",
    };
  }

  const reportingDate = metricReportingDate(metric);
  const calculated = params.key === "runway_months"
    && metric.provenance.sourceLabel.includes("calculated");
  let calculationRole: GenUiMetricCalculationRole | undefined;
  let detail: string | null = null;

  if (calculated) {
    calculationRole = "derived";
  } else if (runwayQuestion) {
    const matchesReferenceDate = reportingDate !== null
      && reportingDate === referenceDate;
    if (params.key === "cash" || params.key === "burn_rate") {
      calculationRole = matchesReferenceDate ? "used" : "context_only";
    } else if (
      params.key === "accounts_receivable"
      || params.key === "accounts_payable"
    ) {
      calculationRole = matchesReferenceDate
        ? "compatible_input"
        : "context_only";
    } else {
      calculationRole = "context_only";
    }

    if (
      calculationRole === "context_only"
      && reportingDate
      && referenceDate
      && reportingDate !== referenceDate
    ) {
      detail = `Does not match the ${referenceDate} runway calculation date.`;
    }
  }

  return {
    reportingDate,
    dateStatus: (reportingDate
      ? calculated
        ? "calculated_for"
        : "latest_recorded"
      : "undated") as GenUiMetricDateStatus,
    ...(calculationRole ? { calculationRole } : {}),
    detail,
  };
}

export function formatCurrency(
  value: number | null | undefined,
  currency: string | null | undefined,
) {
  if (value === null || value === undefined) return "-";
  if (!isSupportedFinancialCurrency(currency)) {
    return currency ? `${currency} not supported` : "Currency not provided";
  }
  return formatFinancialCurrency(value, currency);
}

export function formatNumber(value: number | null | undefined, decimals = 1) {
  return value === null || value === undefined ? "-" : value.toFixed(decimals);
}

export function widgetId(type: GenUiWidgetType, index: number) {
  return `${type}-${Date.now()}-${index}`;
}

export function listMissingMetrics(snapshot: SourceAwareMetricReadResult) {
  return FINANCIAL_METRIC_KEYS.filter(
    (key) => !isAvailableMetric(snapshot.metrics[key]),
  );
}

