import { dashboardCanvasTokens as dashboardTokens } from "@/app/theme";
import {
  formatFinancialCurrency,
  isSupportedFinancialCurrency,
} from "@/lib/financial-data/currency";
import type {
  GenUiMetricCalculationRole,
  GenUiMetricDateStatus,
} from "@/lib/gen-ui/types";

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

export function formatDate(date: string) {
  return new Intl.DateTimeFormat("en-NZ", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${date}T00:00:00.000Z`));
}

export function formatAxisDate(date: string) {
  return new Intl.DateTimeFormat("en-NZ", {
    month: "short",
    year: "numeric",
  }).format(new Date(`${date}T00:00:00.000Z`));
}

export function formatAxisNumber(value: number, isRunway: boolean) {
  if (isRunway) return value.toFixed(1);
  return new Intl.NumberFormat("en-NZ", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatPeriod(points: Array<{ date: string }>) {
  const first = points[0]?.date;
  const latest = points.at(-1)?.date;
  if (!first || !latest) return "Unavailable";
  return first === latest ? formatDate(first) : `${formatDate(first)}–${formatDate(latest)}`;
}

function metricDateLabel(metric: {
  reportingDate?: string | null;
  dateStatus?: GenUiMetricDateStatus;
}) {
  if (!metric.reportingDate) {
    return metric.dateStatus === "undated" ? "Reporting date unavailable" : null;
  }
  const date = formatDate(metric.reportingDate);
  if (metric.dateStatus === "calculated_for") return `Calculated for ${date}`;
  if (metric.dateStatus === "unavailable_for") return `Unavailable for ${date}`;
  return `Latest recorded · ${date}`;
}

function calculationRoleLabel(role?: GenUiMetricCalculationRole) {
  switch (role) {
    case "used": return "Used in cash runway";
    case "compatible_input": return "Same-period adjusted input";
    case "context_only": return "Context only · not used";
    case "derived": return "Derived from compatible inputs";
    case "unavailable": return "Not calculation-ready";
    default: return null;
  }
}

export function metricContextLabel(metric: {
  reportingDate?: string | null;
  dateStatus?: GenUiMetricDateStatus;
  calculationRole?: GenUiMetricCalculationRole;
}) {
  return [metricDateLabel(metric), calculationRoleLabel(metric.calculationRole)]
    .filter(Boolean)
    .join(" · ");
}

export const chartContextChipSx = {
  color: dashboardTokens.info,
  bgcolor: "rgba(59, 130, 246, 0.14)",
  border: "1px solid rgba(96, 165, 250, 0.3)",
  fontWeight: 600,
};

export function trendDirectionColor(direction: string) {
  if (direction === "improving") return dashboardTokens.positive;
  if (direction === "worsening") return dashboardTokens.negative;
  if (direction === "stable") return dashboardTokens.warning;
  return dashboardTokens.textSoft;
}
