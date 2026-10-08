"use client";

import {
  Box,
  Chip,
  Stack,
  Typography,
} from "@mui/material";
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
import { dashboardCanvasTokens as dashboardTokens } from "@/app/theme";
import {
  formatFinancialCurrency,
  isSupportedFinancialCurrency,
} from "@/lib/financial-data/currency";
import { MetricCard } from "../../../../MetricCard";
import type {
  MetricSnapshotWidget as MetricSnapshotWidgetModel,
  MetricSourceEvidenceWidget as MetricSourceEvidenceWidgetModel,
  MetricForecastChartWidget as MetricForecastChartWidgetModel,
  MetricTrendChartWidget as MetricTrendChartWidgetModel,
} from "@/lib/gen-ui/types";
import { WidgetFrame } from "../../shared/WidgetFrame";
import {
  chartContextChipSx,
  formatAxisDate,
  formatAxisNumber,
  formatPeriod,
  metricContextLabel,
  trendDirectionColor,
} from "../../shared/formatting";

const METRIC_COLORS: Record<string, string> = {
  cash: dashboardTokens.positive,
  accounts_receivable: dashboardTokens.info,
  accounts_payable: "#9B451C",
  runway_months: dashboardTokens.info,
  burn_rate: dashboardTokens.negative,
  monthly_revenue: dashboardTokens.positive,
  monthly_expenses: dashboardTokens.negative,
};

export function MetricSnapshotWidgetView({
  widget,
}: {
  widget: MetricSnapshotWidgetModel;
}) {
  return (
    <WidgetFrame title={widget.title} reason={widget.reason}>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))",
          gap: 1.5,
        }}
      >
        {widget.data.metrics.map((metric) => (
          <MetricCard
            key={`${metric.key}:${metric.runwayVariant ?? 'metric'}`}
            label={metric.label}
            value={metric.value}
            unit={metric.unit ?? undefined}
            color={metric.runwayVariant === 'working_capital_adjusted' ? dashboardTokens.adjusted : METRIC_COLORS[metric.key] ?? dashboardTokens.textMuted}
            sourceLabel={metric.sourceLabel}
            sourceTone={metric.sourceTone}
            contextLabel={metricContextLabel(metric)}
            detail={metric.detail}
          />
        ))}
      </Box>
    </WidgetFrame>
  );
}

export function MetricSourceEvidenceWidgetView({
  widget,
}: {
  widget: MetricSourceEvidenceWidgetModel;
}) {
  const tonePresentation = {
    available: { label: "available", color: dashboardTokens.positive, background: "rgba(22, 130, 93, 0.10)" },
    derived: { label: "calculated", color: dashboardTokens.info, background: "rgba(43, 106, 155, 0.10)" },
    unavailable: { label: "unavailable", color: dashboardTokens.negative, background: "rgba(180, 60, 80, 0.10)" },
  } as const;
  const contextOnlyPresentation = {
    label: "context only",
    color: dashboardTokens.warning,
    background: "rgba(245, 158, 11, 0.12)",
  } as const;

  return (
    <WidgetFrame title={widget.title} reason={widget.reason}>
      <Stack spacing={1}>
        {widget.data.metrics.map((metric) => {
          const presentation =
            metric.calculationRole === "context_only"
              ? contextOnlyPresentation
              : tonePresentation[metric.tone];

          return (
            <Stack
              key={metric.label}
              direction={{ xs: "column", sm: "row" }}
              spacing={1}
              justifyContent="space-between"
              sx={{
                p: 1.25,
                borderRadius: 1,
                border: "1px solid",
                borderColor: dashboardTokens.border,
                bgcolor: dashboardTokens.surfaceAlt,
              }}
            >
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body2" fontWeight={700}>
                {metric.label}
              </Typography>
              <Typography variant="caption" sx={{ color: dashboardTokens.textMuted }}>
                {metric.sourceLabel}
              </Typography>
              {metricContextLabel(metric) ? (
                <Typography variant="caption" sx={{ color: dashboardTokens.info, display: "block", mt: 0.25 }}>
                  {metricContextLabel(metric)}
                </Typography>
              ) : null}
              {metric.detail ? (
                <Typography variant="caption" sx={{ color: dashboardTokens.textMuted, display: "block", mt: 0.25 }}>
                  {metric.detail}
                </Typography>
              ) : null}
            </Box>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="body2" sx={{ color: dashboardTokens.text }}>
                {metric.value}
              </Typography>
              <Chip
                label={presentation.label}
                size="small"
                sx={{
                  color: presentation.color,
                  bgcolor: presentation.background,
                }}
              />
            </Stack>
            </Stack>
          );
        })}
      </Stack>
    </WidgetFrame>
  );
}

export function MetricTrendChartWidgetView({
  widget,
}: {
  widget: MetricTrendChartWidgetModel;
}) {
  const isRunway = widget.data.metricKey === 'runway_months';
  const color = METRIC_COLORS[widget.data.metricKey];
  const runwaySeries = isRunway ? (widget.data.runwaySeries ?? []) : [];
  const chartData: Array<Record<string, string | number | undefined>> = runwaySeries.length > 0
    ? [...new Set(runwaySeries.flatMap((series) => series.points.map((point) => point.date)))]
        .sort()
        .map((date) => ({
          date,
          cash: runwaySeries.find((series) => series.variant === 'cash')?.points.find((point) => point.date === date)?.value,
          adjusted: runwaySeries.find((series) => series.variant === 'working_capital_adjusted')?.points.find((point) => point.date === date)?.value,
        }))
    : widget.data.points;
  const formatValue = (value: number) =>
    isRunway
      ? `${value.toFixed(1)} mo`
      : isSupportedFinancialCurrency(widget.data.currency)
        ? formatFinancialCurrency(value, widget.data.currency)
        : "Currency not provided";

  return (
    <WidgetFrame title={widget.title} reason={widget.reason}>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        <Chip label={isRunway ? "Unit: months" : `Currency: ${widget.data.currency}`} size="small" sx={chartContextChipSx} />
        <Chip label={`Reporting period: ${formatPeriod(widget.data.points)}`} size="small" sx={chartContextChipSx} />
        <Chip label={`Observations: ${widget.data.points.length}`} size="small" sx={chartContextChipSx} />
      </Stack>
      <Typography variant="body2" fontWeight={700} sx={{ color: dashboardTokens.text }}>
        Value axis: <Box component="span" sx={{ color: dashboardTokens.info }}>{isRunway ? "Runway (months)" : `${widget.data.label} (${widget.data.currency})`}</Box>
      </Typography>
      <Box sx={{ height: "clamp(220px, 30cqi, 320px)", width: "100%", minWidth: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 10, right: 16, left: 8, bottom: 30 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={dashboardTokens.border} />
            <XAxis
              dataKey="date"
              stroke={dashboardTokens.textMuted}
              style={{ fontSize: "0.72rem" }}
              tickFormatter={(value) => formatAxisDate(String(value))}
              label={{ value: "Reporting date", position: "insideBottom", offset: -16 }}
            />
            <YAxis
              width={58}
              stroke={dashboardTokens.textMuted}
              style={{ fontSize: "0.72rem" }}
              tickFormatter={(value) => formatAxisNumber(Number(value), isRunway)}
            />
            <Legend formatter={(value) => runwaySeries.length > 0 ? value === 'cash' ? 'Cash runway' : 'Working-capital-adjusted runway' : "Actual"} verticalAlign="top" />
            <Tooltip
              contentStyle={{
                backgroundColor: dashboardTokens.surface,
                border: `1px solid ${dashboardTokens.border}`,
                borderRadius: 4,
                color: "white",
              }}
              formatter={(value, _name, item) => {
                if (runwaySeries.length > 0) {
                  return [formatValue(Number(value)), item.dataKey === 'cash' ? 'Cash runway' : 'Working-capital-adjusted runway'];
                }
                const point = item.payload as MetricTrendChartWidgetModel['data']['points'][number];
                return [`${formatValue(Number(value))} — ${point.sourceLabel}`, widget.data.label];
              }}
            />
            {runwaySeries.length > 0 ? (
              <>
                {runwaySeries.some((series) => series.variant === 'cash') ? <Line type="monotone" dataKey="cash" stroke={dashboardTokens.info} strokeWidth={2} dot={{ fill: dashboardTokens.info, r: 4 }} connectNulls={false} /> : null}
                {runwaySeries.some((series) => series.variant === 'working_capital_adjusted') ? <Line type="monotone" dataKey="adjusted" stroke={dashboardTokens.adjusted} strokeWidth={2} dot={{ fill: dashboardTokens.adjusted, r: 4 }} connectNulls={false} /> : null}
              </>
            ) : <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={{ fill: color, r: 4 }} />}
          </LineChart>
        </ResponsiveContainer>
      </Box>
      <Typography variant="body2" fontWeight={700} sx={{ color: trendDirectionColor(widget.data.direction), textTransform: "capitalize" }}>
        Trend: {widget.data.direction}
      </Typography>
      <Typography variant="caption" sx={{ color: dashboardTokens.textMuted }}>
        {widget.data.note}
      </Typography>
      {widget.data.hasRecordedDateFallback ? (
        <Typography variant="caption" sx={{ color: dashboardTokens.warning }}>
          Some points use upload dates because reporting dates were unavailable.
        </Typography>
      ) : null}
    </WidgetFrame>
  );
}

export function MetricForecastChartWidgetView({
  widget,
}: {
  widget: MetricForecastChartWidgetModel;
}) {
  const isRunway = widget.data.metricKey === "runway_months";
  const color = METRIC_COLORS[widget.data.metricKey];
  const runwaySeries = isRunway ? (widget.data.runwaySeries ?? []) : [];
  const formatValue = (value: number) =>
    isRunway
      ? `${value.toFixed(1)} mo`
      : isSupportedFinancialCurrency(widget.data.currency)
        ? formatFinancialCurrency(value, widget.data.currency)
        : "Currency not provided";
  const latestActual = widget.data.actualPoints.at(-1);
  const runwayForecastValueAt = (
    variant: 'cash' | 'working_capital_adjusted',
    date: string,
  ) => {
    const series = runwaySeries.find((candidate) => candidate.variant === variant);
    const forecastValue = series?.forecastPoints.find((point) => point.date === date)?.value;
    const latestSeriesActual = series?.actualPoints.at(-1);
    return forecastValue ?? (latestSeriesActual?.date === date ? latestSeriesActual.value : undefined);
  };
  const data: Array<Record<string, string | number | undefined>> = runwaySeries.length > 0
    ? [...new Set(runwaySeries.flatMap((series) => [
        ...series.actualPoints.map((point) => point.date),
        ...series.forecastPoints.map((point) => point.date),
      ]))].sort().map((date) => ({
        date,
        cashActual: runwaySeries.find((series) => series.variant === 'cash')?.actualPoints.find((point) => point.date === date)?.value,
        adjustedActual: runwaySeries.find((series) => series.variant === 'working_capital_adjusted')?.actualPoints.find((point) => point.date === date)?.value,
        cashForecast: runwayForecastValueAt('cash', date),
        adjustedForecast: runwayForecastValueAt('working_capital_adjusted', date),
      }))
    : [
    ...widget.data.actualPoints.map((point, index) => ({
      ...point,
      actual: point.value,
      forecast: index === widget.data.actualPoints.length - 1 ? point.value : undefined,
    })),
    ...widget.data.forecastPoints.map((point) => ({ ...point, forecast: point.value })),
    ];

  return (
    <WidgetFrame title={widget.title} reason={widget.reason}>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        <Chip label={isRunway ? "Unit: months" : `Currency: ${widget.data.currency}`} size="small" sx={chartContextChipSx} />
        <Chip label={`Historical period: ${formatPeriod(widget.data.actualPoints)}`} size="small" sx={chartContextChipSx} />
        <Chip label={`Forecast period: Next ${widget.data.horizon} months`} size="small" sx={chartContextChipSx} />
      </Stack>
      <Typography variant="body2" fontWeight={700} sx={{ color: dashboardTokens.text }}>
        Value axis: <Box component="span" sx={{ color: dashboardTokens.info }}>{isRunway ? "Runway (months)" : `${widget.data.label} (${widget.data.currency})`}</Box>
      </Typography>
      <Box sx={{ height: "clamp(220px, 30cqi, 320px)", width: "100%", minWidth: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 16, left: 8, bottom: 30 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={dashboardTokens.border} />
            <XAxis
              dataKey="date"
              stroke={dashboardTokens.textMuted}
              style={{ fontSize: "0.72rem" }}
              tickFormatter={(value) => formatAxisDate(String(value))}
              label={{ value: "Reporting date", position: "insideBottom", offset: -16 }}
            />
            <YAxis
              width={58}
              stroke={dashboardTokens.textMuted}
              style={{ fontSize: "0.72rem" }}
              tickFormatter={(value) => formatAxisNumber(Number(value), isRunway)}
            />
            <Legend verticalAlign="top" formatter={(value) => runwaySeries.length > 0 ? ({ cashActual: 'Cash runway', adjustedActual: 'Adjusted runway', cashForecast: 'Cash forecast', adjustedForecast: 'Adjusted forecast' }[String(value)] ?? value) : value === "actual" ? "Actual" : "Forecast"} />
            <Tooltip
              contentStyle={{ backgroundColor: dashboardTokens.surface, border: `1px solid ${dashboardTokens.border}`, borderRadius: 4, color: "white" }}
              formatter={(value, name) => [formatValue(Number(value)), runwaySeries.length > 0 ? ({ cashActual: 'Cash runway', adjustedActual: 'Adjusted runway', cashForecast: 'Cash forecast', adjustedForecast: 'Adjusted forecast' }[String(name)] ?? name) : name === "actual" ? "Actual" : "Forecast"]}
            />
            {runwaySeries.length > 0 ? <>
              {runwaySeries.some((series) => series.variant === 'cash') ? <><Line type="monotone" dataKey="cashActual" stroke={dashboardTokens.info} strokeWidth={2} dot={{ fill: dashboardTokens.info, r: 4 }} connectNulls={false} /><Line type="monotone" dataKey="cashForecast" stroke={dashboardTokens.info} strokeWidth={2} strokeDasharray="6 4" connectNulls={false} /></> : null}
              {runwaySeries.some((series) => series.variant === 'working_capital_adjusted') ? <><Line type="monotone" dataKey="adjustedActual" stroke={dashboardTokens.adjusted} strokeWidth={2} dot={{ fill: dashboardTokens.adjusted, r: 4 }} connectNulls={false} /><Line type="monotone" dataKey="adjustedForecast" stroke={dashboardTokens.adjusted} strokeWidth={2} strokeDasharray="6 4" connectNulls={false} /></> : null}
            </> : <><Line type="monotone" dataKey="actual" stroke={color} strokeWidth={2} dot={{ fill: color, r: 4 }} connectNulls={false} /><Line type="monotone" dataKey="forecast" stroke={dashboardTokens.warning} strokeWidth={2} strokeDasharray="6 4" dot={{ fill: dashboardTokens.warning, r: 4 }} connectNulls={false} /></>}
          </LineChart>
        </ResponsiveContainer>
      </Box>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        <Chip label={`Latest ${formatValue(latestActual?.value ?? 0)}`} size="small" sx={{ color: dashboardTokens.info, bgcolor: "rgba(43, 106, 155, 0.10)" }} />
        <Chip label={`${widget.data.monthlySlope >= 0 ? "+" : ""}${formatValue(widget.data.monthlySlope)} / month`} size="small" sx={{ color: dashboardTokens.warning, bgcolor: "rgba(154, 101, 18, 0.10)" }} />
        <Chip label={`${widget.data.horizon}-month estimate`} size="small" sx={{ color: dashboardTokens.positive, bgcolor: "rgba(22, 130, 93, 0.10)" }} />
      </Stack>
      <Typography variant="caption" sx={{ color: dashboardTokens.textMuted }}>{widget.data.note}</Typography>
      {widget.data.hasRecordedDateFallback ? <Typography variant="caption" sx={{ color: dashboardTokens.warning }}>Some points use upload dates because reporting dates were unavailable.</Typography> : null}
    </WidgetFrame>
  );
}
