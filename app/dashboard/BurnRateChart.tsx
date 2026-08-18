"use client";

import { useEffect, useState } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  ButtonGroup,
  Chip,
  CircularProgress,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { dashboardTokens } from "@/app/theme";
import {
  HISTORICAL_METRIC_KEYS,
  type HistoricalMetricKey,
  type MetricHistoryRange,
  type MetricHistorySummary,
} from "@/lib/financial-data/metric-history";
import type {
  ForecastHorizon,
  MetricForecastSummary,
} from "@/lib/financial-data/metric-forecast";
import { FINANCIAL_METRIC_LABELS } from "@/lib/financial-data/metric-keys";
import {
  formatFinancialCurrency,
  isSupportedFinancialCurrency,
} from "@/lib/financial-data/currency";

const RANGE_OPTIONS: MetricHistoryRange[] = ["3m", "6m", "all"];
const RANGE_LABELS: Record<MetricHistoryRange, string> = {
  "3m": "Last 3 months",
  "6m": "Last 6 months",
  all: "Latest 12 records",
};

const METRIC_DISPLAY_LABELS: Record<HistoricalMetricKey, string> = {
  ...FINANCIAL_METRIC_LABELS,
  cash: "Cash balance",
};

const METRIC_COLORS: Record<HistoricalMetricKey, string> = {
  cash: "#00e5a0",
  monthly_revenue: "#22c55e",
  monthly_expenses: "#f43f5e",
  burn_rate: "#ff4d6d",
  runway_months: "#4da6ff",
};

interface HistoryResponse {
  success: boolean;
  data?: MetricHistorySummary;
  error?: { message?: string };
}

interface ForecastResponse {
  success: boolean;
  data?: MetricForecastSummary;
  error?: { message?: string };
}

type ChartMode = "history" | "forecast";
const FORECAST_HORIZONS: ForecastHorizon[] = [3, 6];

function formatValue(
  value: number,
  metricKey: HistoricalMetricKey,
  currency: string | null,
) {
  if (metricKey === "runway_months") return `${value.toFixed(1)} mo`;

  if (isSupportedFinancialCurrency(currency)) {
    return formatFinancialCurrency(value, currency);
  }

  return "Currency not provided";
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en-NZ", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${date}T00:00:00.000Z`));
}

function formatAxisDate(date: string) {
  return new Intl.DateTimeFormat("en-NZ", {
    month: "short",
    year: "numeric",
  }).format(new Date(`${date}T00:00:00.000Z`));
}

function formatReportingPeriod(history: MetricHistorySummary) {
  const firstDate = history.points[0]?.date;
  const latestDate = history.points.at(-1)?.date;

  if (!firstDate || !latestDate) return "Unavailable";
  if (firstDate === latestDate) return formatDate(firstDate);

  return `${formatDate(firstDate)}–${formatDate(latestDate)}`;
}

function formatPercentage(value: number | null) {
  if (value === null) return "";

  return ` (${value >= 0 ? "+" : ""}${value.toFixed(1)}%)`;
}

function chartAxisLabel(history: MetricHistorySummary) {
  if (history.metricKey === "runway_months") return "Runway (months)";

  return `${METRIC_DISPLAY_LABELS[history.metricKey]} (${history.currency ?? "currency unavailable"})`;
}

function formatAxisValue(value: number, metricKey: HistoricalMetricKey) {
  if (metricKey === "runway_months") return value.toFixed(1);

  return new Intl.NumberFormat("en-NZ", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

const contextChipSx = {
  color: "#dbeafe",
  bgcolor: "rgba(59, 130, 246, 0.14)",
  border: "1px solid rgba(96, 165, 250, 0.3)",
  fontWeight: 600,
};

function directionColor(direction: MetricHistorySummary["direction"]) {
  if (direction === "improving") return "#34d399";
  if (direction === "worsening") return "#fb7185";
  if (direction === "stable") return "#fbbf24";
  return dashboardTokens.textMuted;
}

export function HistoricalMetricsChart({ refreshKey }: { refreshKey: string }) {
  const [metricKey, setMetricKey] = useState<HistoricalMetricKey>("cash");
  const [range, setRange] = useState<MetricHistoryRange>("3m");
  const [mode, setMode] = useState<ChartMode>("history");
  const [horizon, setHorizon] = useState<ForecastHorizon>(3);
  const [history, setHistory] = useState<MetricHistorySummary | null>(null);
  const [forecast, setForecast] = useState<MetricForecastSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    async function loadChartData() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          mode === "history"
            ? `/api/financial-data/history?metricKey=${metricKey}&range=${range}`
            : `/api/financial-data/forecast?metricKey=${metricKey}&range=${range}&horizon=${horizon}`,
          { signal: controller.signal },
        );
        const payload = (await response.json()) as HistoryResponse | ForecastResponse;

        if (!response.ok || !payload.success || !payload.data) {
          throw new Error(payload.error?.message ?? "Could not load historical data.");
        }

        if (mode === "history") {
          setHistory(payload.data as MetricHistorySummary);
          setForecast(null);
        } else {
          setForecast(payload.data as MetricForecastSummary);
          setHistory(null);
        }
      } catch (requestError) {
        if (requestError instanceof DOMException && requestError.name === "AbortError") {
          return;
        }

        setError(
          requestError instanceof Error
            ? requestError.message
            : "Could not load historical data.",
        );
        setHistory(null);
        setForecast(null);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void loadChartData();

    return () => controller.abort();
  }, [horizon, metricKey, mode, range, refreshKey]);

  const displayHistory = mode === "forecast" ? forecast?.history ?? null : history;
  const chartHistory =
    displayHistory && displayHistory.points.length >= 2 && !displayHistory.hasIncompatibleCurrencies
      ? displayHistory
      : null;
  const trendColor = displayHistory ? directionColor(displayHistory.direction) : dashboardTokens.textMuted;
  const chartData = chartHistory
    ? [
        ...chartHistory.points.map((point, index) => ({
          ...point,
          actual: point.value,
          forecast:
            mode === "forecast" && index === chartHistory.points.length - 1
              ? point.value
              : undefined,
        })),
        ...(mode === "forecast"
          ? (forecast?.forecastPoints ?? []).map((point) => ({
              date: point.date,
              value: point.value,
              forecast: point.value,
            }))
          : []),
      ]
    : [];

  return (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 2, sm: 2.5 },
        borderRadius: `${dashboardTokens.radiusMd}px`,
        bgcolor: dashboardTokens.surface,
        color: dashboardTokens.text,
        border: "1px solid",
        borderColor: dashboardTokens.border,
      }}
    >
      <Stack spacing={2}>
        <Stack
          direction={{ xs: "column", md: "row" }}
          alignItems={{ md: "center" }}
          justifyContent="space-between"
          spacing={1.5}
        >
          <Box>
            <Typography sx={{ fontSize: 16, fontWeight: 600 }}>
              Financial trend and forecast
            </Typography>
            <Typography variant="caption" sx={{ color: dashboardTokens.textMuted }}>
              Uses dated financial observations and deterministic projections, not mock data.
            </Typography>
          </Box>
          <Stack direction="row" spacing={1.25} alignItems="flex-end" flexWrap="wrap" useFlexGap>
            <TextField
              select
              size="small"
              label="Financial metric"
              value={metricKey}
              onChange={(event) => setMetricKey(event.target.value as HistoricalMetricKey)}
              sx={{ minWidth: 170, "& .MuiInputBase-root": { color: "common.white" } }}
            >
              {HISTORICAL_METRIC_KEYS.map((key) => (
                <MenuItem key={key} value={key}>
                  {METRIC_DISPLAY_LABELS[key]}
                </MenuItem>
              ))}
            </TextField>
            <Stack spacing={0.5}>
              <Typography variant="caption" sx={{ color: dashboardTokens.textMuted }}>
                History range
              </Typography>
              <ButtonGroup size="small" aria-label="History range">
                {RANGE_OPTIONS.map((option) => (
                  <Button
                    key={option}
                    onClick={() => setRange(option)}
                    variant={range === option ? "contained" : "outlined"}
                    sx={{
                      color: range === option ? "common.white" : dashboardTokens.textMuted,
                      borderColor: dashboardTokens.borderMuted,
                      minWidth: 44,
                      textTransform: "none",
                    }}
                  >
                    {RANGE_LABELS[option]}
                  </Button>
                ))}
              </ButtonGroup>
            </Stack>
            <Stack spacing={0.5}>
              <Typography variant="caption" sx={{ color: dashboardTokens.textMuted }}>
                View
              </Typography>
              <ButtonGroup size="small" aria-label="Chart view">
                {(["history", "forecast"] as const).map((option) => (
                  <Button
                    key={option}
                    onClick={() => setMode(option)}
                    variant={mode === option ? "contained" : "outlined"}
                    sx={{
                      color: mode === option ? "common.white" : dashboardTokens.textMuted,
                      borderColor: dashboardTokens.borderMuted,
                      textTransform: "none",
                    }}
                  >
                    {option === "history" ? "History" : "Forecast"}
                  </Button>
                ))}
              </ButtonGroup>
            </Stack>
            {mode === "forecast" ? (
              <Stack spacing={0.5}>
                <Typography variant="caption" sx={{ color: dashboardTokens.textMuted }}>
                  Forecast period
                </Typography>
                <ButtonGroup size="small" aria-label="Forecast period">
                  {FORECAST_HORIZONS.map((option) => (
                    <Button
                      key={option}
                      onClick={() => setHorizon(option)}
                      variant={horizon === option ? "contained" : "outlined"}
                      sx={{
                        color: horizon === option ? "common.white" : dashboardTokens.textMuted,
                        borderColor: dashboardTokens.borderMuted,
                        minWidth: 48,
                        textTransform: "none",
                      }}
                    >
                      Next {option} months
                    </Button>
                  ))}
                </ButtonGroup>
              </Stack>
            ) : null}
          </Stack>
        </Stack>

        {loading ? (
          <Stack alignItems="center" justifyContent="center" sx={{ minHeight: 280 }} spacing={1}>
            <CircularProgress size={28} />
            <Typography variant="body2" sx={{ color: dashboardTokens.textMuted }}>
              Loading {mode === "forecast" ? "forecast" : "historical observations"}...
            </Typography>
          </Stack>
        ) : error ? (
          <Alert severity="error">{error}</Alert>
        ) : displayHistory?.hasIncompatibleCurrencies ? (
          <Alert severity="warning">
            This history contains both NZD and AUD. AI-BOSS does not convert or
            combine currencies, so this single-currency view is blocked. Separate
            currency charts are planned for the next implementation phase.
          </Alert>
        ) : displayHistory?.points.length === 0 &&
          displayHistory.excludedCurrencyObservationCount > 0 ? (
          <Alert severity="warning">
            No supported, currency-labelled observations are available for this
            monetary metric. NZD and AUD are supported for the MVP; missing and
            unsupported currencies are excluded from calculations.
          </Alert>
        ) : !chartHistory ? (
          <Alert severity="info">
            Upload at least two dated records for {displayHistory?.label.toLowerCase() ?? "this metric"} to view a {mode === "forecast" ? "forecast" : "historical trend"}.
          </Alert>
        ) : (
          <>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Chip
                size="small"
                label={
                  chartHistory.metricKey === "runway_months"
                    ? "Unit: months"
                    : `Currency: ${chartHistory.currency}`
                }
                sx={contextChipSx}
              />
              <Chip
                size="small"
                label={`Reporting period: ${formatReportingPeriod(chartHistory)}`}
                sx={contextChipSx}
              />
              <Chip
                size="small"
                label={`Observations: ${chartHistory.points.length}`}
                sx={contextChipSx}
              />
              <Chip
                size="small"
                label={`Latest reporting date: ${formatDate(chartHistory.points.at(-1)?.date ?? "")}`}
                sx={contextChipSx}
              />
            </Stack>
            {chartHistory.excludedCurrencyObservationCount > 0 ? (
              <Alert severity="warning">
                {chartHistory.excludedCurrencyObservationCount} observation
                {chartHistory.excludedCurrencyObservationCount === 1 ? " was" : "s were"} excluded
                from calculations because currency was missing or unsupported.
                {chartHistory.unsupportedCurrencies.length > 0
                  ? ` Unsupported: ${chartHistory.unsupportedCurrencies.join(", ")}.`
                  : ""}
              </Alert>
            ) : null}
            <Box>
              <Typography
                variant="body2"
                fontWeight={700}
                sx={{ color: dashboardTokens.text, mb: 0.75 }}
              >
                Value axis: <Box component="span" sx={{ color: "#bae6fd" }}>{chartAxisLabel(chartHistory)}</Box>
              </Typography>
            </Box>
            <Box sx={{ width: "100%", height: 320 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 12, right: 20, left: 8, bottom: 32 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={dashboardTokens.border} />
                  <XAxis
                    dataKey="date"
                    stroke={dashboardTokens.textMuted}
                    style={{ fontSize: "0.75rem" }}
                    tickFormatter={(value) => formatAxisDate(value)}
                    label={{ value: "Reporting date", position: "insideBottom", offset: -18 }}
                  />
                  <YAxis
                    width={64}
                    stroke={dashboardTokens.textMuted}
                    style={{ fontSize: "0.75rem" }}
                    tickFormatter={(value) => formatAxisValue(value, chartHistory.metricKey)}
                  />
                  <Legend
                    verticalAlign="top"
                    formatter={(value) => (value === "actual" ? "Actual" : "Forecast")}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: dashboardTokens.surfaceAlt,
                      border: `1px solid ${dashboardTokens.border}`,
                      borderRadius: 4,
                      color: "white",
                    }}
                    labelFormatter={(value) => formatDate(String(value))}
                    formatter={(value, _name, item) => {
                      const point = item.payload as MetricHistorySummary["points"][number] & { forecast?: number };
                      return [
                        point.sourceLabel
                          ? `${formatValue(Number(value), chartHistory.metricKey, chartHistory.currency)} — ${point.sourceLabel} (${Math.round(point.confidence * 100)}%)`
                          : formatValue(Number(value), chartHistory.metricKey, chartHistory.currency),
                        item.dataKey === "forecast" ? "Forecast" : chartHistory.label,
                      ];
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="actual"
                    stroke={METRIC_COLORS[chartHistory.metricKey]}
                    dot={{ fill: METRIC_COLORS[chartHistory.metricKey], r: 4 }}
                    activeDot={{ r: 6 }}
                    strokeWidth={2}
                  />
                  {mode === "forecast" ? (
                    <Line
                      type="monotone"
                      dataKey="forecast"
                      stroke="#fbbf24"
                      strokeDasharray="6 4"
                      dot={{ fill: "#fbbf24", r: 4 }}
                      activeDot={{ r: 6 }}
                      strokeWidth={2}
                      connectNulls={false}
                    />
                  ) : null}
                </LineChart>
              </ResponsiveContainer>
            </Box>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", md: "repeat(3, minmax(0, 1fr))" },
                gap: 1,
              }}
            >
              <Box sx={{ p: 1.25, borderRadius: 1, bgcolor: `${trendColor}12`, border: `1px solid ${trendColor}40` }}>
                <Typography variant="body2" fontWeight={700} sx={{ color: trendColor, textTransform: "capitalize" }}>
                  {chartHistory.direction === "insufficient_data" ? "Trend unavailable" : `Trend: ${chartHistory.direction}`}
                </Typography>
              </Box>
              <Box sx={{ p: 1.25, borderRadius: 1, bgcolor: "rgba(14, 165, 233, 0.08)", border: "1px solid rgba(56, 189, 248, 0.22)" }}>
                <Typography variant="caption" sx={{ color: dashboardTokens.textMuted }}>Change over selected period</Typography>
                <Typography variant="body2" fontWeight={700} sx={{ color: "#e0f2fe" }}>
                  {chartHistory.totalChange === null
                    ? "-"
                    : `${METRIC_DISPLAY_LABELS[chartHistory.metricKey]} ${chartHistory.movement} by ${formatValue(Math.abs(chartHistory.totalChange), chartHistory.metricKey, chartHistory.currency)}${formatPercentage(chartHistory.percentageChange)}`}
                </Typography>
              </Box>
              <Box sx={{ p: 1.25, borderRadius: 1, bgcolor: "rgba(167, 139, 250, 0.08)", border: "1px solid rgba(196, 181, 253, 0.22)" }}>
                <Typography variant="caption" sx={{ color: dashboardTokens.textMuted }}>Latest recorded value</Typography>
                <Typography variant="body2" fontWeight={700} sx={{ color: "#ede9fe" }}>
                  {chartHistory.latestValue === null
                    ? "-"
                    : `${formatValue(chartHistory.latestValue, chartHistory.metricKey, chartHistory.currency)} as at ${formatDate(chartHistory.points.at(-1)?.date ?? "")}`}
                </Typography>
              </Box>
              {mode === "forecast" && forecast && forecast.monthlySlope !== null ? (
                <Box sx={{ p: 1.25, borderRadius: 1, bgcolor: "rgba(251, 191, 36, 0.08)", border: "1px solid rgba(253, 224, 71, 0.22)" }}>
                  <Typography variant="caption" sx={{ color: dashboardTokens.textMuted }}>Projected monthly change</Typography>
                  <Typography variant="body2" fontWeight={700} sx={{ color: "#fde68a" }}>
                    {forecast.monthlySlope >= 0 ? "+" : ""}{formatValue(forecast.monthlySlope, chartHistory.metricKey, chartHistory.currency)}
                  </Typography>
                </Box>
              ) : null}
            </Box>
            <Typography variant="body2" sx={{ color: dashboardTokens.textSoft }}>
              <Box component="span" fontWeight={700} sx={{ color: "#bae6fd" }}>Data source{chartHistory.sourceLabels.length === 1 ? "" : "s"}:</Box> {chartHistory.sourceLabels.join(", ")} · <Box component="span" fontWeight={700}>{chartHistory.points.length} observation{chartHistory.points.length === 1 ? "" : "s"}</Box> · <Box component="span" fontWeight={700}>Latest reporting date:</Box> {formatDate(chartHistory.points.at(-1)?.date ?? "")}
            </Typography>
            {chartHistory.hasMixedSources ? (
              <Alert severity="warning">
                This trend combines sources: {chartHistory.sourceLabels.join(", ")}. Compare changes cautiously.
              </Alert>
            ) : null}
            {chartHistory.hasRecordedDateFallback ? (
              <Alert severity="info">
                At least one point uses its upload/recorded date because a financial reporting date was unavailable.
              </Alert>
            ) : null}
            {mode === "forecast" ? (
              <Alert severity="info">
                Based on {chartHistory.points.length} observations from {formatReportingPeriod(chartHistory)}. {forecast?.assumptions[0] ?? "Forecasts continue the observed historical trend."} This is not a guaranteed prediction.
              </Alert>
            ) : null}
            <Accordion
              disableGutters
              elevation={0}
              sx={{
                bgcolor: "transparent",
                color: dashboardTokens.text,
                border: "1px solid",
                borderColor: dashboardTokens.border,
                "&:before": { display: "none" },
              }}
            >
              <AccordionSummary expandIcon={<ExpandMoreRoundedIcon sx={{ color: dashboardTokens.textMuted }} />}>
                <Typography variant="body2" fontWeight={600}>
                  View data details
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Stack spacing={0.75}>
                  <Typography variant="body2">Sources: {chartHistory.sourceLabels.join(", ")}</Typography>
                  <Typography variant="body2">
                    Date quality: {chartHistory.hasRecordedDateFallback
                      ? "Includes upload/recorded-date fallbacks"
                      : "Financial reporting dates"}
                  </Typography>
                  <Typography variant="body2">
                    Currency treatment: {chartHistory.metricKey === "runway_months"
                      ? "Not applicable; runway is measured in months"
                      : `${chartHistory.currency}; no conversion or cross-currency combination`}
                  </Typography>
                  <Typography variant="body2">
                    Calculation: {mode === "forecast"
                      ? "Date-aware linear trend projected from the latest actual observation"
                      : "Deterministic change across dated financial observations"}
                  </Typography>
                </Stack>
              </AccordionDetails>
            </Accordion>
          </>
        )}
      </Stack>
    </Paper>
  );
}

// Kept as a temporary alias for imports that still use the former component name.
export const BurnRateChart = HistoricalMetricsChart;
