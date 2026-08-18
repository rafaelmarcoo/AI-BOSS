"use client";

import type { ReactNode } from "react";
import {
  Box,
  Button,
  Chip,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import ChatBubbleRoundedIcon from "@mui/icons-material/ChatBubbleRounded";
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
  formatFinancialCurrency,
  isSupportedFinancialCurrency,
} from "@/lib/financial-data/currency";
import { DataSourcesPanel } from "@/components/data-sources-panel";
import { GEN_UI_WIDGET_CATALOG } from "@/lib/gen-ui/catalog";
import { MetricCard } from "../../MetricCard";
import type {
  DataConnectionsWidget as DataConnectionsWidgetModel,
  GenUiPlan,
  GenUiWidget,
  HighlightExplainerWidget as HighlightExplainerWidgetModel,
  MetricSnapshotWidget as MetricSnapshotWidgetModel,
  MetricSourceEvidenceWidget as MetricSourceEvidenceWidgetModel,
  MetricForecastChartWidget as MetricForecastChartWidgetModel,
  MetricTrendChartWidget as MetricTrendChartWidgetModel,
  MissingDataPanelWidget as MissingDataPanelWidgetModel,
  PlanningChecklistWidget as PlanningChecklistWidgetModel,
  RiskThresholdTimelineWidget as RiskThresholdTimelineWidgetModel,
  ScenarioComparisonWidget as ScenarioComparisonWidgetModel,
} from "@/lib/gen-ui/types";

type AskChatbotMode = "selection" | "prompt";

interface GenUiCanvasProps {
  plan: GenUiPlan | null;
  baselineSummary: string;
  missingMetricLabels: string[];
  onAskChatbot: (text: string, mode?: AskChatbotMode) => void;
}

const EXAMPLE_PROMPTS = [
  "Plan the next 6 months from my current runway.",
  "What happens if monthly burn increases by 15%?",
  "When do I hit 3 months of runway?",
  "Which costs should I review first?",
  "Show me a future cash and runway trend.",
];

function formatCurrency(
  value: number | null | undefined,
  currency: string | null | undefined,
) {
  if (value === null || value === undefined) {
    return "-";
  }

  if (!isSupportedFinancialCurrency(currency)) {
    return currency ? `${currency} not supported` : "Currency not provided";
  }

  return formatFinancialCurrency(value, currency);
}

function formatNumber(value: number | null | undefined, decimals = 1) {
  if (value === null || value === undefined) {
    return "-";
  }

  return value.toFixed(decimals);
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

function formatAxisNumber(value: number, isRunway: boolean) {
  if (isRunway) return value.toFixed(1);

  return new Intl.NumberFormat("en-NZ", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatPeriod(points: Array<{ date: string }>) {
  const first = points[0]?.date;
  const latest = points.at(-1)?.date;

  if (!first || !latest) return "Unavailable";
  return first === latest ? formatDate(first) : `${formatDate(first)}–${formatDate(latest)}`;
}

function statusColor(status: RiskThresholdTimelineWidgetModel["data"]["status"]) {
  if (status === "urgent") return "#fb7185";
  if (status === "caution") return "#fbbf24";
  if (status === "healthy") return "#34d399";
  return dashboardTokens.textMuted;
}

const METRIC_COLORS: Record<string, string> = {
  cash: "#00e5a0",
  accounts_receivable: "#38bdf8",
  accounts_payable: "#f97316",
  runway_months: "#4da6ff",
  burn_rate: "#ff4d6d",
  monthly_revenue: "#22c55e",
  monthly_expenses: "#f43f5e",
};

const chartContextChipSx = {
  color: "#dbeafe",
  bgcolor: "rgba(59, 130, 246, 0.14)",
  border: "1px solid rgba(96, 165, 250, 0.3)",
  fontWeight: 600,
};

function trendDirectionColor(direction: string) {
  if (direction === "improving") return "#34d399";
  if (direction === "worsening") return "#fb7185";
  if (direction === "stable") return "#fbbf24";
  return dashboardTokens.textSoft;
}

function WidgetFrame({
  title,
  reason,
  children,
}: {
  title: string;
  reason: string;
  children: ReactNode;
}) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        borderRadius: `${dashboardTokens.radiusMd}px`,
        bgcolor: dashboardTokens.surface,
        border: "1px solid",
        borderColor: dashboardTokens.border,
        color: "common.white",
        minWidth: 0,
      }}
    >
      <Stack spacing={1.75}>
        <Typography sx={{ fontSize: 16, fontWeight: 600 }}>{title}</Typography>
        {children}
        <Box
          sx={{
            pt: 1.25,
            borderTop: "1px solid",
            borderColor: dashboardTokens.border,
          }}
        >
          <Typography
            variant="caption"
            fontWeight={700}
            sx={{ color: "#bae6fd", letterSpacing: 0 }}
          >
            Why AI-BOSS chose this widget
          </Typography>
          <Typography
            variant="body2"
            sx={{ color: dashboardTokens.textMuted, lineHeight: 1.6, mt: 0.5 }}
          >
            {reason}
          </Typography>
        </Box>
      </Stack>
    </Paper>
  );
}

function MetricSnapshotWidgetView({
  widget,
}: {
  widget: MetricSnapshotWidgetModel;
}) {
  return (
    <WidgetFrame title={widget.title} reason={widget.reason}>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr",
            sm: "repeat(2, minmax(0, 1fr))",
          },
          gap: 1.5,
        }}
      >
        {widget.data.metrics.map((metric) => (
          <MetricCard
            key={metric.key}
            label={metric.label}
            value={metric.value}
            unit={metric.unit ?? undefined}
            color={METRIC_COLORS[metric.key] ?? "#94a3b8"}
            sourceLabel={metric.sourceLabel}
            sourceTone={metric.sourceTone}
          />
        ))}
      </Box>
    </WidgetFrame>
  );
}

function DataConnectionsWidgetView({
  widget,
}: {
  widget: DataConnectionsWidgetModel;
}) {
  return (
    <WidgetFrame title={widget.title} reason={widget.reason}>
      <Typography variant="body2" sx={{ color: dashboardTokens.textMuted }}>
        {widget.data.message}
      </Typography>
      <DataSourcesPanel />
    </WidgetFrame>
  );
}

function ScenarioComparisonWidgetView({
  widget,
}: {
  widget: ScenarioComparisonWidgetModel;
}) {
  const rows = [widget.data.base, ...widget.data.scenarios];
  const maxRunway = Math.max(
    1,
    ...rows.map((row) => row.runwayMonths ?? 0)
  );

  return (
    <WidgetFrame title={widget.title} reason={widget.reason}>
      <Chip
        label={`Currency: ${widget.data.currency}`}
        size="small"
        sx={{ alignSelf: "flex-start", color: "#bae6fd", bgcolor: "rgba(14, 165, 233, 0.12)" }}
      />
      <Stack spacing={1.25}>
        {rows.map((row) => {
          const runwayPercent = ((row.runwayMonths ?? 0) / maxRunway) * 100;

          return (
            <Box key={row.label}>
              <Stack
                direction="row"
                justifyContent="space-between"
                spacing={1}
                sx={{ mb: 0.75 }}
              >
                <Typography variant="body2" fontWeight={700}>
                  {row.label}
                </Typography>
                <Typography variant="body2" sx={{ color: dashboardTokens.textMuted }}>
                  {formatCurrency(row.monthlyBurn, widget.data.currency)} burn
                </Typography>
              </Stack>
              <Stack direction="row" spacing={1.25} alignItems="center">
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box
                    sx={{
                      height: 8,
                      borderRadius: 999,
                      bgcolor: "rgba(255,255,255,0.08)",
                      overflow: "hidden",
                    }}
                  >
                    <Box
                      sx={{
                        width: `${Math.max(2, runwayPercent)}%`,
                        height: "100%",
                        bgcolor: row.label === "Current" ? "#38bdf8" : "#a78bfa",
                        borderRadius: 999,
                      }}
                    />
                  </Box>
                </Box>
                <Typography
                  variant="body2"
                  sx={{ width: 74, textAlign: "right", color: "common.white" }}
                >
                  {formatNumber(row.runwayMonths)} mo
                </Typography>
              </Stack>
            </Box>
          );
        })}
      </Stack>
      <Typography variant="caption" sx={{ color: dashboardTokens.textMuted }}>
        {widget.data.note}
      </Typography>
    </WidgetFrame>
  );
}

function PlanningChecklistWidgetView({
  widget,
}: {
  widget: PlanningChecklistWidgetModel;
}) {
  const toneColors = {
    urgent: "#fb7185",
    watch: "#fbbf24",
    steady: "#34d399",
  };

  return (
    <WidgetFrame title={widget.title} reason={widget.reason}>
      <Stack spacing={1}>
        {widget.data.items.map((item) => (
          <Stack
            key={item.label}
            direction="row"
            spacing={1.25}
            sx={{
              p: 1.25,
              borderRadius: 1,
              bgcolor: "rgba(255,255,255,0.03)",
              border: "1px solid",
              borderColor: dashboardTokens.border,
            }}
          >
            <Box
              sx={{
                width: 9,
                height: 9,
                borderRadius: "50%",
                mt: 0.6,
                bgcolor: toneColors[item.tone],
                flex: "0 0 auto",
              }}
            />
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body2" fontWeight={700}>
                {item.label}
              </Typography>
              <Typography variant="caption" sx={{ color: dashboardTokens.textMuted }}>
                {item.detail}
              </Typography>
            </Box>
          </Stack>
        ))}
      </Stack>
    </WidgetFrame>
  );
}

function RiskThresholdTimelineWidgetView({
  widget,
}: {
  widget: RiskThresholdTimelineWidgetModel;
}) {
  const color = statusColor(widget.data.status);
  const runwayPercent =
    widget.data.currentRunway === null
      ? 0
      : Math.min(100, (widget.data.currentRunway / 12) * 100);

  return (
    <WidgetFrame title={widget.title} reason={widget.reason}>
      <Stack spacing={1.25}>
        <Stack direction="row" justifyContent="space-between" spacing={1}>
          <Typography variant="body2" sx={{ color: dashboardTokens.textMuted }}>
            Current runway
          </Typography>
          <Typography variant="body2" fontWeight={700} sx={{ color }}>
            {formatNumber(widget.data.currentRunway)} months
          </Typography>
        </Stack>
        <Box
          sx={{
            height: 10,
            borderRadius: 999,
            bgcolor: "rgba(255,255,255,0.08)",
            overflow: "hidden",
          }}
        >
          <Box
            sx={{
              width: `${Math.max(0, runwayPercent)}%`,
              height: "100%",
              bgcolor: color,
              borderRadius: 999,
            }}
          />
        </Box>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
            gap: 1,
          }}
        >
          <Box sx={{ p: 1.25, borderRadius: 1, bgcolor: "rgba(251,191,36,0.08)" }}>
            <Typography variant="caption" sx={{ color: "#fde68a" }}>
              Caution
            </Typography>
            <Typography variant="body2" fontWeight={700}>
              {widget.data.monthsUntilCaution === null
                ? "Not trending there"
                : `${widget.data.monthsUntilCaution} mo`}
            </Typography>
          </Box>
          <Box sx={{ p: 1.25, borderRadius: 1, bgcolor: "rgba(251,113,133,0.08)" }}>
            <Typography variant="caption" sx={{ color: "#fecdd3" }}>
              Urgent
            </Typography>
            <Typography variant="body2" fontWeight={700}>
              {widget.data.monthsUntilUrgent === null
                ? "Not trending there"
                : `${widget.data.monthsUntilUrgent} mo`}
            </Typography>
          </Box>
        </Box>
        <Typography variant="body2" sx={{ color: dashboardTokens.textMuted }}>
          {widget.data.message}
        </Typography>
      </Stack>
    </WidgetFrame>
  );
}

function MetricSourceEvidenceWidgetView({
  widget,
}: {
  widget: MetricSourceEvidenceWidgetModel;
}) {
  return (
    <WidgetFrame title={widget.title} reason={widget.reason}>
      <Stack spacing={1}>
        {widget.data.metrics.map((metric) => (
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
              bgcolor: "rgba(255,255,255,0.025)",
            }}
          >
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body2" fontWeight={700}>
                {metric.label}
              </Typography>
              <Typography variant="caption" sx={{ color: dashboardTokens.textMuted }}>
                {metric.sourceLabel}
              </Typography>
            </Box>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="body2" sx={{ color: "common.white" }}>
                {metric.value}
              </Typography>
              <Chip
                label={metric.tone}
                size="small"
                sx={{
                  color: metric.tone === "available" ? "#bbf7d0" : "#fecdd3",
                  bgcolor:
                    metric.tone === "available"
                      ? "rgba(34, 197, 94, 0.12)"
                      : "rgba(244, 63, 94, 0.12)",
                }}
              />
            </Stack>
          </Stack>
        ))}
      </Stack>
    </WidgetFrame>
  );
}

function MetricTrendChartWidgetView({
  widget,
}: {
  widget: MetricTrendChartWidgetModel;
}) {
  const isRunway = widget.data.metricKey === 'runway_months';
  const color = METRIC_COLORS[widget.data.metricKey];
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
        Value axis: <Box component="span" sx={{ color: "#bae6fd" }}>{isRunway ? "Runway (months)" : `${widget.data.label} (${widget.data.currency})`}</Box>
      </Typography>
      <Box sx={{ height: 250 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={widget.data.points} margin={{ top: 10, right: 16, left: 8, bottom: 30 }}>
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
            <Legend formatter={() => "Actual"} verticalAlign="top" />
            <Tooltip
              contentStyle={{
                backgroundColor: dashboardTokens.surface,
                border: `1px solid ${dashboardTokens.border}`,
                borderRadius: 4,
                color: "white",
              }}
              formatter={(value, _name, item) => {
                const point = item.payload as MetricTrendChartWidgetModel['data']['points'][number];
                return [`${formatValue(Number(value))} — ${point.sourceLabel}`, widget.data.label];
              }}
            />
            <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={{ fill: color, r: 4 }} />
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
        <Typography variant="caption" sx={{ color: "#fde68a" }}>
          Some points use upload dates because reporting dates were unavailable.
        </Typography>
      ) : null}
    </WidgetFrame>
  );
}

function MetricForecastChartWidgetView({
  widget,
}: {
  widget: MetricForecastChartWidgetModel;
}) {
  const isRunway = widget.data.metricKey === "runway_months";
  const color = METRIC_COLORS[widget.data.metricKey];
  const formatValue = (value: number) =>
    isRunway
      ? `${value.toFixed(1)} mo`
      : isSupportedFinancialCurrency(widget.data.currency)
        ? formatFinancialCurrency(value, widget.data.currency)
        : "Currency not provided";
  const latestActual = widget.data.actualPoints.at(-1);
  const data = [
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
        Value axis: <Box component="span" sx={{ color: "#bae6fd" }}>{isRunway ? "Runway (months)" : `${widget.data.label} (${widget.data.currency})`}</Box>
      </Typography>
      <Box sx={{ height: 250 }}>
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
            <Legend
              verticalAlign="top"
              formatter={(value) => (value === "actual" ? "Actual" : "Forecast")}
            />
            <Tooltip
              contentStyle={{ backgroundColor: dashboardTokens.surface, border: `1px solid ${dashboardTokens.border}`, borderRadius: 4, color: "white" }}
              formatter={(value, name) => [formatValue(Number(value)), name === "actual" ? "Actual" : "Forecast"]}
            />
            <Line type="monotone" dataKey="actual" stroke={color} strokeWidth={2} dot={{ fill: color, r: 4 }} connectNulls={false} />
            <Line type="monotone" dataKey="forecast" stroke="#fbbf24" strokeWidth={2} strokeDasharray="6 4" dot={{ fill: "#fbbf24", r: 4 }} connectNulls={false} />
          </LineChart>
        </ResponsiveContainer>
      </Box>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        <Chip label={`Latest ${formatValue(latestActual?.value ?? 0)}`} size="small" sx={{ color: "#bae6fd", bgcolor: "rgba(14, 165, 233, 0.12)" }} />
        <Chip label={`${widget.data.monthlySlope >= 0 ? "+" : ""}${formatValue(widget.data.monthlySlope)} / month`} size="small" sx={{ color: "#fde68a", bgcolor: "rgba(251, 191, 36, 0.12)" }} />
        <Chip label={`${widget.data.horizon}-month estimate`} size="small" sx={{ color: "#bbf7d0", bgcolor: "rgba(34, 197, 94, 0.12)" }} />
      </Stack>
      <Typography variant="caption" sx={{ color: dashboardTokens.textMuted }}>{widget.data.note}</Typography>
      {widget.data.hasRecordedDateFallback ? <Typography variant="caption" sx={{ color: "#fde68a" }}>Some points use upload dates because reporting dates were unavailable.</Typography> : null}
    </WidgetFrame>
  );
}

function MissingDataPanelWidgetView({
  widget,
}: {
  widget: MissingDataPanelWidgetModel;
}) {
  return (
    <WidgetFrame title={widget.title} reason={widget.reason}>
      <Stack spacing={1}>
        <Typography variant="body2" sx={{ color: dashboardTokens.textMuted }}>
          {widget.data.message}
        </Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {widget.data.missingMetrics.map((metric) => (
            <Chip
              key={metric}
              label={metric}
              size="small"
              sx={{
                color: "#fecdd3",
                bgcolor: "rgba(244, 63, 94, 0.12)",
              }}
            />
          ))}
        </Stack>
      </Stack>
    </WidgetFrame>
  );
}

function HighlightExplainerWidgetView({
  widget,
  onAskChatbot,
}: {
  widget: HighlightExplainerWidgetModel;
  onAskChatbot: (text: string, mode?: AskChatbotMode) => void;
}) {
  return (
    <WidgetFrame title={widget.title} reason={widget.reason}>
      <Stack spacing={1.25}>
        <Box
          sx={{
            p: 1.5,
            borderRadius: 1,
            bgcolor: "rgba(59, 130, 246, 0.10)",
            border: "1px solid",
            borderColor: "rgba(96, 165, 250, 0.22)",
          }}
        >
          <Typography variant="body2" sx={{ color: "common.white", lineHeight: 1.6 }}>
            {widget.data.selectedText}
          </Typography>
        </Box>
        <Button
          size="small"
          variant="outlined"
          startIcon={<ChatBubbleRoundedIcon fontSize="small" />}
          onClick={() => onAskChatbot(widget.data.prompt, "prompt")}
          sx={{
            alignSelf: "flex-start",
            borderRadius: 999,
            color: "common.white",
            borderColor: dashboardTokens.borderMuted,
            textTransform: "none",
          }}
        >
          Ask follow-up
        </Button>
      </Stack>
    </WidgetFrame>
  );
}

interface GenUiWidgetRendererProps {
  widget: GenUiWidget;
  onAskChatbot: (text: string, mode?: AskChatbotMode) => void;
}

export function GenUiWidgetRenderer({
  widget,
  onAskChatbot,
}: GenUiWidgetRendererProps) {
  switch (widget.type) {
    case "metric_snapshot":
      return <MetricSnapshotWidgetView widget={widget} />;
    case "data_connections":
      return <DataConnectionsWidgetView widget={widget} />;
    case "metric_trend_chart":
      return <MetricTrendChartWidgetView widget={widget} />;
    case "metric_forecast_chart":
      return <MetricForecastChartWidgetView widget={widget} />;
    case "scenario_comparison":
      return <ScenarioComparisonWidgetView widget={widget} />;
    case "planning_checklist":
      return <PlanningChecklistWidgetView widget={widget} />;
    case "risk_threshold_timeline":
      return <RiskThresholdTimelineWidgetView widget={widget} />;
    case "metric_source_evidence":
      return <MetricSourceEvidenceWidgetView widget={widget} />;
    case "missing_data_panel":
      return <MissingDataPanelWidgetView widget={widget} />;
    case "highlight_explainer":
      return (
        <HighlightExplainerWidgetView
          widget={widget}
          onAskChatbot={onAskChatbot}
        />
      );
  }
}

export function GenUiCanvas({
  plan,
  baselineSummary,
  missingMetricLabels,
  onAskChatbot,
}: GenUiCanvasProps) {
  const hasPlan = Boolean(plan && plan.widgets.length > 0);

  return (
    <Paper
      elevation={0}
      sx={{
        p: 0,
        borderRadius: 0,
        bgcolor: "transparent",
        color: dashboardTokens.text,
        border: 0,
        overflow: "hidden",
      }}
    >
      <Stack spacing={0}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          alignItems={{ xs: "flex-start", sm: "center" }}
          justifyContent="space-between"
          spacing={1}
          sx={{ pb: 3 }}
        >
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Box sx={{ minWidth: 0 }}>
              <Typography component="h1" sx={{ fontSize: { xs: 20, sm: 22 }, fontWeight: 600, letterSpacing: "-0.02em" }}>
                Generated workspace
              </Typography>
              <Typography
                variant="body2"
                sx={{ color: dashboardTokens.textMuted }}
              >
                {hasPlan
                  ? plan?.summary
                  : "Financial context generated from your current AI-BOSS conversation."}
              </Typography>
            </Box>
          </Stack>
          <Chip
            label="Live"
            size="small"
            sx={{
              height: 24,
              color: dashboardTokens.positive,
              bgcolor: "rgba(62, 180, 137, 0.10)",
              borderColor: "rgba(62, 180, 137, 0.22)",
              borderRadius: `${dashboardTokens.radiusSm}px`,
              fontSize: 12,
              alignSelf: { xs: "flex-start", sm: "center" },
            }}
            variant="outlined"
          />
        </Stack>

        <Paper
          elevation={0}
          sx={{
            py: 3,
            borderRadius: 0,
            bgcolor: "transparent",
            borderTop: "1px solid",
            borderColor: dashboardTokens.border,
          }}
        >
          <Typography component="h2" sx={{ fontSize: 16, fontWeight: 600 }}>
            Runway summary
          </Typography>
          <Stack spacing={1}>
            <Typography
              variant="body2"
              sx={{ mt: 1, color: dashboardTokens.textMuted, lineHeight: 1.65, userSelect: "text" }}
            >
              {baselineSummary}
            </Typography>
          </Stack>
        </Paper>

        <Box sx={{ py: 3, borderTop: "1px solid", borderColor: dashboardTokens.border }}>
          <Typography component="h2" sx={{ fontSize: 16, fontWeight: 600 }}>
            {missingMetricLabels.length > 0 ? "Missing financial metrics" : "Financial metrics"}
          </Typography>
          <Typography sx={{ mt: 0.75, color: dashboardTokens.textMuted, fontSize: 14, lineHeight: 1.55 }}>
            {missingMetricLabels.length > 0
              ? "Connect an accounting source or upload current records to complete the runway view."
              : "The core metrics required for runway analysis are available."}
          </Typography>
          {missingMetricLabels.length > 0 ? (
            <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mt: 2 }}>
              {missingMetricLabels.map((label) => (
                <Chip
                  key={label}
                  label={label}
                  size="small"
                  sx={{
                    height: 26,
                    borderRadius: `${dashboardTokens.radiusSm}px`,
                    color: "#D9AAA3",
                    bgcolor: "rgba(201, 129, 116, 0.09)",
                    border: "1px solid rgba(201, 129, 116, 0.18)",
                    fontSize: 12,
                  }}
                />
              ))}
            </Stack>
          ) : null}
        </Box>

        <Box sx={{ py: 3, borderTop: "1px solid", borderColor: dashboardTokens.border }}>
          <Typography component="h2" sx={{ fontSize: 16, fontWeight: 600 }}>
            Why this matters
          </Typography>
          <Typography sx={{ mt: 0.75, maxWidth: 760, color: dashboardTokens.textMuted, fontSize: 14, lineHeight: 1.6 }}>
            Reliable cash, burn, revenue, and liability data helps AI-BOSS explain how long the business can operate and where finance teams should focus next.
          </Typography>
        </Box>

        {hasPlan ? (
          <Box
            sx={{
              py: 3,
              borderTop: "1px solid",
              borderColor: dashboardTokens.border,
              display: "grid",
              gridTemplateColumns: { xs: "1fr", xl: "repeat(2, minmax(0, 1fr))" },
              gap: 2,
            }}
          >
            {plan?.widgets.map((widget) => (
              <Box
                key={widget.id}
                sx={{
                  minWidth: 0,
                  gridColumn: {
                    xs: "span 1",
                    xl: `span ${GEN_UI_WIDGET_CATALOG[widget.type].defaultColumnSpan}`,
                  },
                }}
              >
                <GenUiWidgetRenderer
                  widget={widget}
                  onAskChatbot={onAskChatbot}
                />
              </Box>
            ))}
          </Box>
        ) : (
          <Paper
            elevation={0}
            sx={{
              py: 3,
              borderRadius: 0,
              bgcolor: "transparent",
              borderTop: "1px solid",
              borderColor: dashboardTokens.border,
            }}
          >
            <Stack spacing={0.75}>
              <Typography sx={{ fontSize: 16, fontWeight: 600 }}>
                Feature testing context
              </Typography>
              <Typography sx={{ color: dashboardTokens.textMuted, fontSize: 14, lineHeight: 1.55 }}>
                Highlight dashboard text to ask AI-BOSS for an explanation, or use a follow-up below.
              </Typography>
            </Stack>
          </Paper>
        )}

        <Stack spacing={1.25}>
          <Typography sx={{ fontSize: 16, fontWeight: 600 }}>
            Ask a follow-up
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {EXAMPLE_PROMPTS.map((prompt) => (
              <Button
                key={prompt}
                size="small"
                variant="outlined"
                onClick={() => onAskChatbot(prompt, "prompt")}
                sx={{
                  minHeight: 34,
                  borderRadius: `${dashboardTokens.radiusSm}px`,
                  color: dashboardTokens.textSoft,
                  borderColor: dashboardTokens.border,
                  bgcolor: dashboardTokens.surface,
                  textTransform: "none",
                  fontSize: 13,
                  maxWidth: { xs: "100%", sm: "none" },
                  whiteSpace: "normal",
                  textAlign: "left",
                  "&:hover": {
                    borderColor: dashboardTokens.borderMuted,
                    bgcolor: dashboardTokens.surfaceAlt,
                    color: dashboardTokens.text,
                  },
                }}
              >
                {prompt}
              </Button>
            ))}
          </Stack>
        </Stack>
      </Stack>
    </Paper>
  );
}
