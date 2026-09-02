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
  METRIC_HISTORY_RECORD_LIMITS,
  type HistoricalMetricKey,
  type MetricHistoryRange,
  type MetricHistoryRecordLimit,
  type MetricHistorySeriesCollection,
  type MetricHistorySummary,
} from "@/lib/financial-data/metric-history";
import type {
  ForecastHorizon,
  MetricForecastSeriesCollection,
  MetricForecastSummary,
} from "@/lib/financial-data/metric-forecast";
import { FINANCIAL_METRIC_LABELS } from "@/lib/financial-data/metric-keys";
import {
  formatFinancialCurrency,
  isSupportedFinancialCurrency,
  type SupportedFinancialCurrency,
} from "@/lib/financial-data/currency";

const RANGE_OPTIONS: MetricHistoryRange[] = ["3m", "6m", "all"];
const RANGE_LABELS: Record<MetricHistoryRange, string> = {
  "3m": "Last 3 months",
  "6m": "Last 6 months",
  all: "All dates",
};
const RECORD_LIMIT_LABELS: Record<MetricHistoryRecordLimit, string> = {
  12: "Latest 12",
  25: "Latest 25",
  50: "Latest 50",
  all: "All records",
};
const METRIC_DISPLAY_LABELS: Record<HistoricalMetricKey, string> = {
  ...FINANCIAL_METRIC_LABELS,
  cash: "Cash balance",
  runway_months: "Runway",
};
const METRIC_COLORS: Record<HistoricalMetricKey, string> = {
  cash: "#00e5a0",
  monthly_revenue: "#22c55e",
  monthly_expenses: "#f43f5e",
  burn_rate: "#ff4d6d",
  runway_months: "#4da6ff",
};
const FORECAST_HORIZONS: ForecastHorizon[] = [3, 6];
const contextChipSx = {
  color: "#dbeafe",
  bgcolor: "rgba(59, 130, 246, 0.14)",
  border: "1px solid rgba(96, 165, 250, 0.3)",
  fontWeight: 600,
};

interface HistoryResponse {
  success: boolean;
  data?: MetricHistorySeriesCollection;
  error?: { message?: string };
}

interface ForecastResponse {
  success: boolean;
  data?: MetricForecastSeriesCollection;
  error?: { message?: string };
}

type ChartMode = "history" | "forecast";
type CurrencyFilter = "all" | SupportedFinancialCurrency;
type RunwayPlotSelection = "both" | "cash" | "working_capital_adjusted";

function formatValue(value: number, metricKey: HistoricalMetricKey, currency: string | null) {
  if (metricKey === "runway_months") return `${value.toFixed(1)} mo`;
  return isSupportedFinancialCurrency(currency)
    ? formatFinancialCurrency(value, currency)
    : "Currency not provided";
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
  return firstDate === latestDate
    ? formatDate(firstDate)
    : `${formatDate(firstDate)}–${formatDate(latestDate)}`;
}

function formatPercentage(value: number | null) {
  return value === null ? "" : ` (${value >= 0 ? "+" : ""}${value.toFixed(1)}%)`;
}

function chartAxisLabel(history: MetricHistorySummary) {
  return history.metricKey === "runway_months"
    ? "Runway (months)"
    : `${METRIC_DISPLAY_LABELS[history.metricKey]} (${history.currency ?? "currency unavailable"})`;
}

function formatAxisValue(value: number, metricKey: HistoricalMetricKey) {
  if (metricKey === "runway_months") return value.toFixed(1);
  return new Intl.NumberFormat("en-NZ", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function directionColor(direction: MetricHistorySummary["direction"]) {
  if (direction === "improving") return "#34d399";
  if (direction === "worsening") return "#fb7185";
  if (direction === "stable") return "#fbbf24";
  return dashboardTokens.textMuted;
}

function MetricSeriesPanel({
  history,
  mode,
  forecast,
}: {
  history: MetricHistorySummary;
  mode: ChartMode;
  forecast?: MetricForecastSummary;
}) {
  if (history.points.length < 2) {
    return (
      <Paper variant="outlined" sx={{ p: 2, bgcolor: dashboardTokens.surfaceAlt, borderColor: dashboardTokens.border }}>
        <Alert severity="info">
          {history.metricKey === "runway_months" ? "Cash runway" : history.currency} needs at least two compatible dated records to display a trend.
        </Alert>
      </Paper>
    );
  }

  const trendColor = directionColor(history.direction);
  const chartData = [
    ...history.points.map((point, index) => ({
      ...point,
      actual: point.value,
      forecast: mode === "forecast" && index === history.points.length - 1 ? point.value : undefined,
    })),
    ...(mode === "forecast"
      ? (forecast?.forecastPoints ?? []).map((point) => ({ ...point, forecast: point.value }))
      : []),
  ];

  return (
    <Paper
      variant="outlined"
      sx={{ p: { xs: 1.5, sm: 2 }, bgcolor: dashboardTokens.surfaceAlt, borderColor: dashboardTokens.border }}
    >
      <Stack spacing={1.75}>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Chip size="small" label={history.metricKey === "runway_months" ? "Unit: months" : `Currency: ${history.currency}`} sx={contextChipSx} />
          <Chip size="small" label={`Reporting period: ${formatReportingPeriod(history)}`} sx={contextChipSx} />
          <Chip size="small" label={`Observations: ${history.points.length}`} sx={contextChipSx} />
          <Chip size="small" label={`Latest reporting date: ${formatDate(history.points.at(-1)?.date ?? "")}`} sx={contextChipSx} />
        </Stack>

        <Typography variant="body2" fontWeight={700} sx={{ color: dashboardTokens.text }}>
          Value axis: <Box component="span" sx={{ color: "#bae6fd" }}>{chartAxisLabel(history)}</Box>
        </Typography>

        <Box sx={{ width: "100%", minWidth: 0, height: 320 }}>
          <ResponsiveContainer
            width="100%"
            height="100%"
            minWidth={0}
            initialDimension={{ width: 800, height: 320 }}
          >
            <LineChart data={chartData} margin={{ top: 12, right: 20, left: 8, bottom: 32 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={dashboardTokens.border} />
              <XAxis dataKey="date" stroke={dashboardTokens.textMuted} style={{ fontSize: "0.75rem" }} tickFormatter={formatAxisDate} label={{ value: "Reporting date", position: "insideBottom", offset: -18 }} />
              <YAxis width={64} stroke={dashboardTokens.textMuted} style={{ fontSize: "0.75rem" }} tickFormatter={(value) => formatAxisValue(value, history.metricKey)} />
              <Legend verticalAlign="top" formatter={(value) => value === "actual" ? "Actual" : "Forecast"} />
              <Tooltip
                contentStyle={{ backgroundColor: dashboardTokens.surfaceAlt, border: `1px solid ${dashboardTokens.border}`, borderRadius: 4, color: "white" }}
                labelFormatter={(value) => formatDate(String(value))}
                formatter={(value, _name, item) => {
                  const point = item.payload as MetricHistorySummary["points"][number] & { forecast?: number };
                  return [
                    point.sourceLabel
                      ? `${formatValue(Number(value), history.metricKey, history.currency)} — ${point.sourceLabel} (${Math.round(point.confidence * 100)}%)`
                      : formatValue(Number(value), history.metricKey, history.currency),
                    item.dataKey === "forecast" ? "Forecast" : history.label,
                  ];
                }}
              />
              <Line type="monotone" dataKey="actual" stroke={METRIC_COLORS[history.metricKey]} dot={{ fill: METRIC_COLORS[history.metricKey], r: 4 }} activeDot={{ r: 6 }} strokeWidth={2} />
              {mode === "forecast" ? <Line type="monotone" dataKey="forecast" stroke="#fbbf24" strokeDasharray="6 4" dot={{ fill: "#fbbf24", r: 4 }} activeDot={{ r: 6 }} strokeWidth={2} connectNulls={false} /> : null}
            </LineChart>
          </ResponsiveContainer>
        </Box>

        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, minmax(0, 1fr))" }, gap: 1 }}>
          <Box sx={{ p: 1.25, borderRadius: 1, bgcolor: `${trendColor}12`, border: `1px solid ${trendColor}40` }}>
            <Typography variant="body2" fontWeight={700} sx={{ color: trendColor, textTransform: "capitalize" }}>
              {history.direction === "insufficient_data" ? "Trend unavailable" : `Trend: ${history.direction}`}
            </Typography>
          </Box>
          <Box sx={{ p: 1.25, borderRadius: 1, bgcolor: "rgba(14, 165, 233, 0.08)", border: "1px solid rgba(56, 189, 248, 0.22)" }}>
            <Typography variant="caption" sx={{ color: dashboardTokens.textMuted }}>Change over selected period</Typography>
            <Typography variant="body2" fontWeight={700} sx={{ color: "#e0f2fe" }}>
              {history.totalChange === null ? "-" : `${METRIC_DISPLAY_LABELS[history.metricKey]} ${history.movement} by ${formatValue(Math.abs(history.totalChange), history.metricKey, history.currency)}${formatPercentage(history.percentageChange)}`}
            </Typography>
          </Box>
          <Box sx={{ p: 1.25, borderRadius: 1, bgcolor: "rgba(167, 139, 250, 0.08)", border: "1px solid rgba(196, 181, 253, 0.22)" }}>
            <Typography variant="caption" sx={{ color: dashboardTokens.textMuted }}>Latest recorded value</Typography>
            <Typography variant="body2" fontWeight={700} sx={{ color: "#ede9fe" }}>
              {history.latestValue === null ? "-" : `${formatValue(history.latestValue, history.metricKey, history.currency)} as at ${formatDate(history.points.at(-1)?.date ?? "")}`}
            </Typography>
          </Box>
          {mode === "forecast" && forecast?.monthlySlope !== null && forecast?.monthlySlope !== undefined ? (
            <Box sx={{ p: 1.25, borderRadius: 1, bgcolor: "rgba(251, 191, 36, 0.08)", border: "1px solid rgba(253, 224, 71, 0.22)" }}>
              <Typography variant="caption" sx={{ color: dashboardTokens.textMuted }}>Projected monthly change</Typography>
              <Typography variant="body2" fontWeight={700} sx={{ color: "#fde68a" }}>
                {forecast.monthlySlope >= 0 ? "+" : ""}{formatValue(forecast.monthlySlope, history.metricKey, history.currency)}
              </Typography>
            </Box>
          ) : null}
        </Box>

        <Typography variant="body2" sx={{ color: dashboardTokens.textSoft }}>
          <Box component="span" fontWeight={700} sx={{ color: "#bae6fd" }}>Data source{history.sourceLabels.length === 1 ? "" : "s"}:</Box> {history.sourceLabels.join(", ")} · <Box component="span" fontWeight={700}>{history.points.length} observation{history.points.length === 1 ? "" : "s"}</Box>
        </Typography>
        {history.hasMixedSources ? <Alert severity="warning">This trend combines sources: {history.sourceLabels.join(", ")}. Select one statement for a source-specific view.</Alert> : null}
        {history.hasRecordedDateFallback ? <Alert severity="info">At least one point uses its upload/recorded date because a financial reporting date was unavailable.</Alert> : null}
        {mode === "forecast" ? <Alert severity="info">Based on {history.points.length} observations from {formatReportingPeriod(history)}. {forecast?.assumptions[0] ?? "Forecast unavailable because the series does not have enough distinct dated observations."} This is not a guaranteed prediction.</Alert> : null}

        <Accordion disableGutters elevation={0} sx={{ bgcolor: "transparent", color: dashboardTokens.text, border: "1px solid", borderColor: dashboardTokens.border, "&:before": { display: "none" } }}>
          <AccordionSummary expandIcon={<ExpandMoreRoundedIcon sx={{ color: dashboardTokens.textMuted }} />}>
            <Typography variant="body2" fontWeight={600}>View data details</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Stack spacing={0.75}>
              <Typography variant="body2">Sources: {history.sourceLabels.join(", ")}</Typography>
              <Typography variant="body2">Date quality: {history.hasRecordedDateFallback ? "Includes upload/recorded-date fallbacks" : "Financial reporting dates"}</Typography>
              <Typography variant="body2">Currency treatment: {history.metricKey === "runway_months" ? `${history.currency}; cash and burn matched without conversion` : `${history.currency}; calculated independently with no conversion or cross-currency combination`}</Typography>
              <Typography variant="body2">Calculation: {mode === "forecast" ? "Date-aware linear trend projected from the latest actual observation" : history.metricKey === "runway_months" ? "Cash divided by monthly burn for each matching source, currency, and reporting date" : "Deterministic change across dated financial observations"}</Typography>
            </Stack>
          </AccordionDetails>
        </Accordion>
      </Stack>
    </Paper>
  );
}

function RunwayComparisonPanel({
  views,
  mode,
}: {
  views: Array<{ history: MetricHistorySummary; forecast?: MetricForecastSummary }>;
  mode: ChartMode;
}) {
  const cash = views.find((view) => view.history.runwayVariant === "cash");
  const adjusted = views.find(
    (view) => view.history.runwayVariant === "working_capital_adjusted",
  );
  const dates = [
    ...(cash?.history.points ?? []).map((point) => point.date),
    ...(adjusted?.history.points ?? []).map((point) => point.date),
    ...(mode === "forecast" ? (cash?.forecast?.forecastPoints ?? []).map((point) => point.date) : []),
    ...(mode === "forecast" ? (adjusted?.forecast?.forecastPoints ?? []).map((point) => point.date) : []),
  ];
  const uniqueDates = [...new Set(dates)].sort();
  const valueAt = (points: Array<{ date: string; value: number }>, date: string) =>
    points.find((point) => point.date === date)?.value;
  const forecastValueAt = (
    view: { history: MetricHistorySummary; forecast?: MetricForecastSummary } | undefined,
    date: string,
  ) => {
    const forecastValue = valueAt(view?.forecast?.forecastPoints ?? [], date);
    const latestActual = view?.history.points.at(-1);
    return forecastValue ?? (latestActual?.date === date ? latestActual.value : undefined);
  };
  const chartData = uniqueDates.map((date) => ({
    date,
    cashActual: valueAt(cash?.history.points ?? [], date),
    adjustedActual: valueAt(adjusted?.history.points ?? [], date),
    cashForecast: forecastValueAt(cash, date),
    adjustedForecast: forecastValueAt(adjusted, date),
  }));
  const reportingPeriod = uniqueDates.length === 0
    ? "Unavailable"
    : uniqueDates[0] === uniqueDates.at(-1)
      ? formatDate(uniqueDates[0])
      : `${formatDate(uniqueDates[0])}–${formatDate(uniqueDates.at(-1) as string)}`;
  const latest = (view?: { history: MetricHistorySummary }) => view?.history.latestValue;

  if (views.every((view) => view.history.points.length < 2)) {
    return <Alert severity="info">The selected runway view needs at least two compatible dated records to display a trend.</Alert>;
  }

  return (
    <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2 }, bgcolor: dashboardTokens.surfaceAlt, borderColor: dashboardTokens.border }}>
      <Stack spacing={1.75}>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Chip size="small" label="Unit: months" sx={contextChipSx} />
          <Chip size="small" label={`Reporting period: ${reportingPeriod}`} sx={contextChipSx} />
          <Chip size="small" label={`Cash observations: ${cash?.history.points.length ?? 0}`} sx={contextChipSx} />
          <Chip size="small" label={`Adjusted observations: ${adjusted?.history.points.length ?? 0}`} sx={contextChipSx} />
        </Stack>
        <Typography variant="body2" fontWeight={700} sx={{ color: dashboardTokens.text }}>
          Value axis: <Box component="span" sx={{ color: "#bae6fd" }}>Runway (months)</Box>
        </Typography>
        <Box sx={{ width: "100%", minWidth: 0, height: 320 }}>
          <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 800, height: 320 }}>
            <LineChart data={chartData} margin={{ top: 12, right: 20, left: 8, bottom: 32 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={dashboardTokens.border} />
              <XAxis dataKey="date" stroke={dashboardTokens.textMuted} style={{ fontSize: "0.75rem" }} tickFormatter={formatAxisDate} label={{ value: "Reporting date", position: "insideBottom", offset: -18 }} />
              <YAxis width={64} stroke={dashboardTokens.textMuted} style={{ fontSize: "0.75rem" }} tickFormatter={(value) => Number(value).toFixed(1)} />
              <Legend verticalAlign="top" formatter={(value) => ({ cashActual: "Cash runway", adjustedActual: "Working-capital-adjusted runway", cashForecast: "Cash runway forecast", adjustedForecast: "Adjusted runway forecast" }[String(value)] ?? value)} />
              <Tooltip contentStyle={{ backgroundColor: dashboardTokens.surfaceAlt, border: `1px solid ${dashboardTokens.border}`, borderRadius: 4, color: "white" }} labelFormatter={(value) => formatDate(String(value))} formatter={(value, name) => [`${Number(value).toFixed(2)} months`, ({ cashActual: "Cash runway", adjustedActual: "Working-capital-adjusted runway", cashForecast: "Cash runway forecast", adjustedForecast: "Adjusted runway forecast" }[String(name)] ?? name)]} />
              {cash ? <Line type="monotone" dataKey="cashActual" stroke="#4da6ff" strokeWidth={2} dot={{ fill: "#4da6ff", r: 4 }} connectNulls={false} /> : null}
              {adjusted ? <Line type="monotone" dataKey="adjustedActual" stroke="#22d3ee" strokeWidth={2} dot={{ fill: "#22d3ee", r: 4 }} connectNulls={false} /> : null}
              {mode === "forecast" && cash ? <Line type="monotone" dataKey="cashForecast" stroke="#4da6ff" strokeDasharray="6 4" strokeWidth={2} connectNulls={false} /> : null}
              {mode === "forecast" && adjusted ? <Line type="monotone" dataKey="adjustedForecast" stroke="#22d3ee" strokeDasharray="6 4" strokeWidth={2} connectNulls={false} /> : null}
            </LineChart>
          </ResponsiveContainer>
        </Box>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" }, gap: 1 }}>
          {cash ? <Paper variant="outlined" sx={{ p: 1.25, bgcolor: "rgba(77,166,255,0.08)", borderColor: "rgba(77,166,255,0.28)" }}><Typography variant="caption" sx={{ color: dashboardTokens.textMuted }}>Latest cash runway</Typography><Typography fontWeight={700}>{latest(cash)?.toFixed(2) ?? "-"} months</Typography></Paper> : null}
          {adjusted ? <Paper variant="outlined" sx={{ p: 1.25, bgcolor: "rgba(34,211,238,0.08)", borderColor: "rgba(34,211,238,0.28)" }}><Typography variant="caption" sx={{ color: dashboardTokens.textMuted }}>Latest working-capital-adjusted runway</Typography><Typography fontWeight={700}>{latest(adjusted)?.toFixed(2) ?? "-"} months</Typography></Paper> : null}
        </Box>
        {!adjusted ? <Alert severity="info">Working-capital-adjusted runway is unavailable for this selection because there are not enough same-source, same-currency, same-date confirmed inputs.</Alert> : null}
        <Typography variant="caption" sx={{ color: dashboardTokens.textMuted }}>Cash runway uses cash ÷ burn. Adjusted runway uses (cash + receivables − payables) ÷ burn. Missing adjusted dates are left as gaps.</Typography>
      </Stack>
    </Paper>
  );
}

export function HistoricalMetricsChart({ refreshKey }: { refreshKey: string }) {
  const [metricKey, setMetricKey] = useState<HistoricalMetricKey>("cash");
  const [range, setRange] = useState<MetricHistoryRange>("3m");
  const [mode, setMode] = useState<ChartMode>("history");
  const [horizon, setHorizon] = useState<ForecastHorizon>(3);
  const [currency, setCurrency] = useState<CurrencyFilter>("all");
  const [sourceKey, setSourceKey] = useState("all");
  const [recordLimit, setRecordLimit] = useState<MetricHistoryRecordLimit>(12);
  const [runwayPlot, setRunwayPlot] = useState<RunwayPlotSelection>("both");
  const [history, setHistory] = useState<MetricHistorySeriesCollection | null>(null);
  const [forecast, setForecast] = useState<MetricForecastSeriesCollection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    async function loadChartData() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          metricKey,
          range,
          currency: metricKey === "runway_months" ? "all" : currency,
          recordLimit: String(recordLimit),
        });
        if (sourceKey !== "all") params.set("sourceKey", sourceKey);
        if (mode === "forecast") params.set("horizon", String(horizon));
        const response = await fetch(`/api/financial-data/${mode}?${params.toString()}`, { signal: controller.signal });
        const payload = (await response.json()) as HistoryResponse | ForecastResponse;
        if (!response.ok || !payload.success || !payload.data) {
          throw new Error(payload.error?.message ?? "Could not load financial chart data.");
        }
        if (mode === "history") {
          setHistory(payload.data as MetricHistorySeriesCollection);
          setForecast(null);
        } else {
          setForecast(payload.data as MetricForecastSeriesCollection);
          setHistory(null);
        }
      } catch (requestError) {
        if (requestError instanceof DOMException && requestError.name === "AbortError") return;
        setError(requestError instanceof Error ? requestError.message : "Could not load financial chart data.");
        setHistory(null);
        setForecast(null);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void loadChartData();
    return () => controller.abort();
  }, [currency, horizon, metricKey, mode, range, recordLimit, refreshKey, sourceKey]);

  const collection = mode === "history" ? history : forecast;
  const seriesViews = mode === "history"
    ? (history?.series ?? []).map((series) => ({ history: series, forecast: undefined }))
    : (forecast?.series ?? []).map((series) => ({ history: series.history, forecast: series }));
  const selectedSeriesViews = metricKey === "runway_months"
    ? seriesViews.filter((view) => runwayPlot === "both" || view.history.runwayVariant === runwayPlot)
    : seriesViews;
  const runwayGroups = metricKey === "runway_months"
    ? [...selectedSeriesViews.reduce((groups, view) => {
        const key = `${view.history.seriesKey ?? view.history.sourceLabels.join("|")}:${view.history.currency ?? "unitless"}`;
        groups.set(key, [...(groups.get(key) ?? []), view]);
        return groups;
      }, new Map<string, typeof selectedSeriesViews>()).values()]
    : [];

  return (
    <Paper elevation={0} sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: `${dashboardTokens.radiusMd}px`, bgcolor: dashboardTokens.surface, color: dashboardTokens.text, border: "1px solid", borderColor: dashboardTokens.border }}>
      <Stack spacing={2}>
        <Box>
          <Typography sx={{ fontSize: 16, fontWeight: 600 }}>Financial trend and forecast</Typography>
          <Typography variant="caption" sx={{ color: dashboardTokens.textMuted }}>Each currency is calculated and displayed independently. AI-BOSS never converts or combines NZD and AUD.</Typography>
        </Box>

        <Stack direction="row" spacing={1.25} alignItems="flex-end" flexWrap="wrap" useFlexGap>
          <TextField select size="small" label="Financial metric" value={metricKey} onChange={(event) => { setMetricKey(event.target.value as HistoricalMetricKey); setCurrency("all"); setSourceKey("all"); }} sx={{ minWidth: 170, "& .MuiInputBase-root": { color: "common.white" } }}>
            {HISTORICAL_METRIC_KEYS.map((key) => <MenuItem key={key} value={key}>{METRIC_DISPLAY_LABELS[key]}</MenuItem>)}
          </TextField>
          <Stack spacing={0.5}>
            <Typography variant="caption" sx={{ color: dashboardTokens.textMuted }}>View</Typography>
            <ButtonGroup size="small" aria-label="Chart view">
              {(["history", "forecast"] as const).map((option) => <Button key={option} onClick={() => setMode(option)} variant={mode === option ? "contained" : "outlined"} sx={{ color: mode === option ? "common.white" : dashboardTokens.textMuted, borderColor: dashboardTokens.borderMuted, textTransform: "none" }}>{option === "history" ? "History" : "Forecast"}</Button>)}
            </ButtonGroup>
          </Stack>
          {metricKey !== "runway_months" ? (
            <TextField select size="small" label="Currency" value={currency} onChange={(event) => setCurrency(event.target.value as CurrencyFilter)} sx={{ minWidth: 120, "& .MuiInputBase-root": { color: "common.white" } }}>
              <MenuItem value="all">All currencies</MenuItem>
              {(collection?.availableCurrencies ?? []).map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}
            </TextField>
          ) : null}
          <TextField select size="small" label="Source / statement" value={sourceKey} onChange={(event) => { setSourceKey(event.target.value); setCurrency("all"); }} sx={{ minWidth: 190, "& .MuiInputBase-root": { color: "common.white" } }}>
            <MenuItem value="all">All sources</MenuItem>
            {(collection?.availableSources ?? []).map((source) => <MenuItem key={source.key} value={source.key}>{source.label}</MenuItem>)}
          </TextField>
          <TextField select size="small" label="Records" value={recordLimit} onChange={(event) => setRecordLimit(event.target.value as MetricHistoryRecordLimit)} sx={{ minWidth: 130, "& .MuiInputBase-root": { color: "common.white" } }}>
            {METRIC_HISTORY_RECORD_LIMITS.map((value) => <MenuItem key={value} value={value}>{RECORD_LIMIT_LABELS[value]}</MenuItem>)}
          </TextField>
        </Stack>

        {metricKey === "runway_months" ? (
          <Stack spacing={0.5} alignItems="flex-start">
            <Typography variant="caption" sx={{ color: dashboardTokens.textMuted }}>Runway plots</Typography>
            <ButtonGroup size="small" aria-label="Runway plots">
              {(["both", "cash", "working_capital_adjusted"] as const).map((option) => <Button key={option} onClick={() => setRunwayPlot(option)} variant={runwayPlot === option ? "contained" : "outlined"} sx={{ color: runwayPlot === option ? "common.white" : dashboardTokens.textMuted, borderColor: dashboardTokens.borderMuted, textTransform: "none" }}>{option === "both" ? "Both" : option === "cash" ? "Cash runway" : "Working-capital-adjusted"}</Button>)}
            </ButtonGroup>
          </Stack>
        ) : null}

        <Stack direction="row" spacing={1.25} alignItems="flex-end" flexWrap="wrap" useFlexGap>
          <Stack spacing={0.5}>
            <Typography variant="caption" sx={{ color: dashboardTokens.textMuted }}>History range</Typography>
            <ButtonGroup size="small" aria-label="History range">
              {RANGE_OPTIONS.map((option) => <Button key={option} onClick={() => setRange(option)} variant={range === option ? "contained" : "outlined"} sx={{ color: range === option ? "common.white" : dashboardTokens.textMuted, borderColor: dashboardTokens.borderMuted, textTransform: "none" }}>{RANGE_LABELS[option]}</Button>)}
            </ButtonGroup>
          </Stack>
          {mode === "forecast" ? (
            <Stack spacing={0.5}>
              <Typography variant="caption" sx={{ color: dashboardTokens.textMuted }}>Forecast period</Typography>
              <ButtonGroup size="small" aria-label="Forecast period">
                {FORECAST_HORIZONS.map((option) => <Button key={option} onClick={() => setHorizon(option)} variant={horizon === option ? "contained" : "outlined"} sx={{ color: horizon === option ? "common.white" : dashboardTokens.textMuted, borderColor: dashboardTokens.borderMuted, textTransform: "none" }}>Next {option} months</Button>)}
              </ButtonGroup>
            </Stack>
          ) : null}
        </Stack>

        {loading ? (
          <Stack alignItems="center" justifyContent="center" sx={{ minHeight: 280 }} spacing={1}><CircularProgress size={28} /><Typography variant="body2" sx={{ color: dashboardTokens.textMuted }}>Loading {mode === "forecast" ? "forecast" : "historical observations"}...</Typography></Stack>
        ) : error ? (
          <Alert severity="error">{error}</Alert>
        ) : (
          <>
            {collection && collection.excludedCurrencyObservationCount > 0 ? <Alert severity="warning">{collection.excludedCurrencyObservationCount} observation{collection.excludedCurrencyObservationCount === 1 ? " was" : "s were"} excluded because currency was missing or unsupported.{collection.unsupportedCurrencies.length > 0 ? ` Unsupported: ${collection.unsupportedCurrencies.join(", ")}.` : ""}</Alert> : null}
            {selectedSeriesViews.length === 0 ? <Alert severity="info">No supported observations match the selected metric, currency, source, date range, and record limit.</Alert> : metricKey === "runway_months" ? <Stack spacing={2}>{runwayGroups.map((views, index) => <RunwayComparisonPanel key={`${views[0]?.history.seriesKey ?? "runway"}:${index}`} views={views} mode={mode} />)}</Stack> : <Stack spacing={2}>{selectedSeriesViews.map((view) => <MetricSeriesPanel key={`${view.history.metricKey}:${view.history.sourceLabels.join("|")}:${view.history.currency ?? "unitless"}`} history={view.history} forecast={view.forecast} mode={mode} />)}</Stack>}
          </>
        )}
      </Stack>
    </Paper>
  );
}

export const BurnRateChart = HistoricalMetricsChart;
