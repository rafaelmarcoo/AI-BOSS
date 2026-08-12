"use client";

import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  ButtonGroup,
  CircularProgress,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import {
  CartesianGrid,
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
import { FINANCIAL_METRIC_LABELS } from "@/lib/financial-data/metric-keys";

const RANGE_OPTIONS: MetricHistoryRange[] = ["3m", "6m", "all"];
const RANGE_LABELS: Record<MetricHistoryRange, string> = {
  "3m": "3M",
  "6m": "6M",
  all: "All",
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

function formatValue(
  value: number,
  metricKey: HistoricalMetricKey,
  currency: string | null,
) {
  if (metricKey === "runway_months") return `${value.toFixed(1)} mo`;

  if (currency) {
    return new Intl.NumberFormat("en-NZ", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  }

  return value.toFixed(2);
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en-NZ", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${date}T00:00:00.000Z`));
}

function directionColor(direction: MetricHistorySummary["direction"]) {
  if (direction === "improving") return "#34d399";
  if (direction === "worsening") return "#fb7185";
  if (direction === "stable") return "#fbbf24";
  return dashboardTokens.textMuted;
}

export function HistoricalMetricsChart({ refreshKey }: { refreshKey: string }) {
  const [metricKey, setMetricKey] = useState<HistoricalMetricKey>("cash");
  const [range, setRange] = useState<MetricHistoryRange>("3m");
  const [history, setHistory] = useState<MetricHistorySummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    async function loadHistory() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/financial-data/history?metricKey=${metricKey}&range=${range}`,
          { signal: controller.signal },
        );
        const payload = (await response.json()) as HistoryResponse;

        if (!response.ok || !payload.success || !payload.data) {
          throw new Error(payload.error?.message ?? "Could not load historical data.");
        }

        setHistory(payload.data);
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
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void loadHistory();

    return () => controller.abort();
  }, [metricKey, range, refreshKey]);

  const chartHistory =
    history && history.points.length >= 2 && !history.hasIncompatibleCurrencies
      ? history
      : null;
  const trendColor = history ? directionColor(history.direction) : dashboardTokens.textMuted;

  return (
    <Paper
      elevation={0}
      sx={{
        p: 3,
        borderRadius: 1,
        bgcolor: dashboardTokens.runwayV2,
        color: "common.white",
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
            <Typography variant="h6" fontWeight={700}>
              Historical financial trend
            </Typography>
            <Typography variant="caption" sx={{ color: dashboardTokens.textMuted }}>
              Uses dated financial observations, not mock dashboard data.
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <TextField
              select
              size="small"
              label="Metric"
              value={metricKey}
              onChange={(event) => setMetricKey(event.target.value as HistoricalMetricKey)}
              sx={{ minWidth: 170, "& .MuiInputBase-root": { color: "common.white" } }}
            >
              {HISTORICAL_METRIC_KEYS.map((key) => (
                <MenuItem key={key} value={key}>
                  {FINANCIAL_METRIC_LABELS[key]}
                </MenuItem>
              ))}
            </TextField>
            <ButtonGroup size="small" aria-label="Historical date range">
              {RANGE_OPTIONS.map((option) => (
                <Button
                  key={option}
                  onClick={() => setRange(option)}
                  variant={range === option ? "contained" : "outlined"}
                  sx={{
                    color: range === option ? "common.white" : dashboardTokens.textMuted,
                    borderColor: dashboardTokens.borderMuted,
                    minWidth: 44,
                  }}
                >
                  {RANGE_LABELS[option]}
                </Button>
              ))}
            </ButtonGroup>
          </Stack>
        </Stack>

        {loading ? (
          <Stack alignItems="center" justifyContent="center" sx={{ minHeight: 280 }} spacing={1}>
            <CircularProgress size={28} />
            <Typography variant="body2" sx={{ color: dashboardTokens.textMuted }}>
              Loading historical observations...
            </Typography>
          </Stack>
        ) : error ? (
          <Alert severity="error">{error}</Alert>
        ) : history?.hasIncompatibleCurrencies ? (
          <Alert severity="warning">
            This history contains multiple currencies. AI-BOSS does not convert currencies, so it cannot chart or compare these values.
          </Alert>
        ) : !chartHistory ? (
          <Alert severity="info">
            Upload at least two dated records for {history?.label.toLowerCase() ?? "this metric"} to view a historical trend.
          </Alert>
        ) : (
          <>
            <Box sx={{ width: "100%", height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartHistory.points} margin={{ top: 5, right: 20, left: 4, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={dashboardTokens.border} />
                  <XAxis
                    dataKey="date"
                    stroke={dashboardTokens.textMuted}
                    style={{ fontSize: "0.75rem" }}
                    tickFormatter={(value) => formatDate(value)}
                  />
                  <YAxis
                    stroke={dashboardTokens.textMuted}
                    style={{ fontSize: "0.75rem" }}
                    tickFormatter={(value) => formatValue(value, chartHistory.metricKey, chartHistory.currency)}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: dashboardTokens.surface,
                      border: `1px solid ${dashboardTokens.border}`,
                      borderRadius: 4,
                      color: "white",
                    }}
                    labelFormatter={(value) => formatDate(String(value))}
                    formatter={(value, _name, item) => {
                      const point = item.payload as MetricHistorySummary["points"][number];
                      return [
                        `${formatValue(Number(value), chartHistory.metricKey, chartHistory.currency)} — ${point.sourceLabel} (${Math.round(point.confidence * 100)}%)`,
                        chartHistory.label,
                      ];
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke={METRIC_COLORS[chartHistory.metricKey]}
                    dot={{ fill: METRIC_COLORS[chartHistory.metricKey], r: 4 }}
                    activeDot={{ r: 6 }}
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </Box>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} flexWrap="wrap" useFlexGap>
              <Typography variant="body2" fontWeight={700} sx={{ color: trendColor }}>
                {chartHistory.direction === "insufficient_data" ? "Trend unavailable" : `Trend: ${chartHistory.direction}`}
              </Typography>
              <Typography variant="body2" sx={{ color: dashboardTokens.textMuted }}>
                Change: {chartHistory.totalChange === null ? "-" : formatValue(Math.abs(chartHistory.totalChange), chartHistory.metricKey, chartHistory.currency)}
              </Typography>
              <Typography variant="body2" sx={{ color: dashboardTokens.textMuted }}>
                Latest: {chartHistory.latestValue === null ? "-" : formatValue(chartHistory.latestValue, chartHistory.metricKey, chartHistory.currency)}
              </Typography>
            </Stack>
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
          </>
        )}
      </Stack>
    </Paper>
  );
}

// Kept as a temporary alias for imports that still use the former component name.
export const BurnRateChart = HistoricalMetricsChart;
