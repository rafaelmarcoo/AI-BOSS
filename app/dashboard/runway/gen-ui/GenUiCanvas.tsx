"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import ChatBubbleRoundedIcon from "@mui/icons-material/ChatBubbleRounded";
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
  ScenarioAnalysisWidget as ScenarioAnalysisWidgetModel,
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

const DOCUMENT_REVIEW_PROMPTS = [
  "Why can't AI-BOSS calculate with this document yet?",
  "Which uploaded values still need review?",
  "How do I confirm extracted document values?",
];

const HISTORICAL_DOCUMENT_PROMPTS = [
  "Re-run this document question using the current review status.",
  "Calculate my current runway from User-confirmed values.",
  "Show the User-confirmed financial history for this source.",
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

function metricDateLabel(metric: {
  reportingDate?: string | null;
  dateStatus?: 'latest_recorded' | 'calculated_for' | 'unavailable_for' | 'undated';
}) {
  if (!metric.reportingDate) {
    return metric.dateStatus === 'undated' ? 'Reporting date unavailable' : null;
  }

  const date = formatDate(metric.reportingDate);
  if (metric.dateStatus === 'calculated_for') return `Calculated for ${date}`;
  if (metric.dateStatus === 'unavailable_for') return `Unavailable for ${date}`;
  return `Latest recorded · ${date}`;
}

function calculationRoleLabel(role?:
  | 'used'
  | 'compatible_input'
  | 'context_only'
  | 'derived'
  | 'unavailable') {
  switch (role) {
    case 'used':
      return 'Used in cash runway';
    case 'compatible_input':
      return 'Same-period adjusted input';
    case 'context_only':
      return 'Context only · not used';
    case 'derived':
      return 'Derived from compatible inputs';
    case 'unavailable':
      return 'Not calculation-ready';
    default:
      return null;
  }
}

function metricContextLabel(metric: {
  reportingDate?: string | null;
  dateStatus?: 'latest_recorded' | 'calculated_for' | 'unavailable_for' | 'undated';
  calculationRole?:
    | 'used'
    | 'compatible_input'
    | 'context_only'
    | 'derived'
    | 'unavailable';
}) {
  return [metricDateLabel(metric), calculationRoleLabel(metric.calculationRole)]
    .filter(Boolean)
    .join(' · ');
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
            key={`${metric.key}:${metric.runwayVariant ?? 'metric'}`}
            label={metric.label}
            value={metric.value}
            unit={metric.unit ?? undefined}
            color={metric.runwayVariant === 'working_capital_adjusted' ? '#22d3ee' : METRIC_COLORS[metric.key] ?? "#94a3b8"}
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

const SCENARIO_COLORS = ["#38bdf8", "#a78bfa", "#f59e0b", "#22c55e"];

function ScenarioAnalysisWidgetView({
  widget,
}: {
  widget: ScenarioAnalysisWidgetModel;
}) {
  const { result } = widget.data;
  const projectedMonths = result.panels.find((panel) => panel.available)?.series[0]?.points ?? [];
  const projectedPeriod = projectedMonths.length > 0
    ? `${projectedMonths[0].month}–${projectedMonths.at(-1)?.month}`
    : `${result.projectionStartMonth} onward`;
  const openEditor = () => {
    window.sessionStorage.setItem(
      "ai-boss-scenario-draft",
      JSON.stringify({ input: result.input, result }),
    );
    window.location.assign(widget.data.editHref);
  };

  return (
    <WidgetFrame title={widget.title} reason={widget.reason}>
      <Stack spacing={2}>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Chip label={`Currency: ${result.currency}`} size="small" sx={chartContextChipSx} />
          <Chip label={`Source: ${result.sourceLabel}`} size="small" sx={chartContextChipSx} />
          <Chip label={`Projected period: ${projectedPeriod}`} size="small" sx={chartContextChipSx} />
          <Chip label={`Horizon: ${result.input.horizon} months`} size="small" sx={chartContextChipSx} />
          <Chip label={`Historical range: ${result.input.trendRange.toUpperCase()}`} size="small" sx={chartContextChipSx} />
        </Stack>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "repeat(4, minmax(0, 1fr))" },
            gap: 1,
          }}
        >
          {[
            ["Cash", result.openingBridge.cash],
            ["Accounts receivable", result.openingBridge.accountsReceivable],
            ["Accounts payable", -result.openingBridge.accountsPayable],
            ["Opening liquidity", result.openingLiquidity],
          ].map(([label, value]) => (
            <Box key={String(label)} sx={{ p: 1.25, borderRadius: 1, bgcolor: "rgba(255,255,255,0.035)" }}>
              <Typography variant="caption" sx={{ color: dashboardTokens.textMuted }}>{label}</Typography>
              <Typography variant="body2" fontWeight={700}>{formatCurrency(Number(value), result.currency)}</Typography>
            </Box>
          ))}
        </Box>
        <Typography variant="caption" sx={{ color: dashboardTokens.textMuted }}>
          Opening available liquidity: {formatCurrency(result.openingBridge.cash, result.currency)} cash + {formatCurrency(result.openingBridge.accountsReceivable, result.currency)} receivables − {formatCurrency(result.openingBridge.accountsPayable, result.currency)} payables = {formatCurrency(result.openingLiquidity, result.currency)}. AI-BOSS assumes current receivables are collected and current payables are paid before Month 1.
        </Typography>

        <Box>
          <Typography variant="subtitle2" fontWeight={700}>Baseline inputs and evidence</Typography>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" }, gap: 1, mt: 1 }}>
            {([
              ["Cash", result.metricInputs.cash],
              ["Accounts receivable", result.metricInputs.accountsReceivable],
              ["Accounts payable", result.metricInputs.accountsPayable],
              ["Monthly burn", result.metricInputs.burnRate],
              ["Monthly revenue", result.metricInputs.monthlyRevenue],
              ["Monthly expenses", result.metricInputs.monthlyExpenses],
            ] as const).map(([label, metric]) => (
              <Box key={label} sx={{ p: 1.25, border: "1px solid", borderColor: dashboardTokens.border, borderRadius: 1 }}>
                <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="center">
                  <Typography variant="body2" fontWeight={700}>{label}</Typography>
                  <Chip
                    size="small"
                    color={metric?.origin === "manual" ? "warning" : metric ? "success" : "default"}
                    label={metric?.origin === "manual" ? "Manual — unreviewed" : metric ? "Stored observation" : "Missing"}
                  />
                </Stack>
                {metric ? (
                  <Typography variant="caption" display="block" sx={{ color: dashboardTokens.textMuted, mt: 0.5 }}>
                    {formatCurrency(metric.value, result.currency)} · {metric.sourceLabel} · reporting date {metric.reportingDate} · {metric.confidence === null ? "no verification confidence" : `${Math.round(metric.confidence * 100)}% confidence`}
                  </Typography>
                ) : (
                  <Typography variant="caption" sx={{ color: dashboardTokens.textMuted }}>Not available for this source.</Typography>
                )}
              </Box>
            ))}
          </Box>
        </Box>

        {result.warnings.map((warning) => (
          <Alert key={warning} severity="warning" variant="outlined">{warning}</Alert>
        ))}

        <Alert severity="info" variant="outlined">
          Both charts start from the same opening liquidity. The dashed Baseline means no new decision. Each coloured line adds that scenario&apos;s cash effects, beginning in its stated month. Each plotted month is the projected month-end balance, after that month&apos;s movement.
        </Alert>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", xl: "repeat(2, minmax(0, 1fr))" },
            gap: 2,
          }}
        >
          {result.panels.map((panel) => {
            if (!panel.available) {
              return (
                <Paper key={panel.method} variant="outlined" sx={{ p: 2, bgcolor: "transparent", borderColor: dashboardTokens.border }}>
                  <Typography fontWeight={700}>{panel.label}</Typography>
                  <Alert severity="info" sx={{ mt: 1 }}>{panel.unavailableReason}</Alert>
                </Paper>
              );
            }

            const chartData = panel.series[0]?.points.map((point, index) => ({
              month: point.month,
              ...Object.fromEntries(panel.series.map((series) => [series.id, series.points[index]?.value])),
            })) ?? [];

            return (
              <Paper key={panel.method} variant="outlined" sx={{ p: 1.5, bgcolor: "transparent", borderColor: dashboardTokens.border }}>
                <Typography fontWeight={700}>
                  {panel.method === "current_run_rate"
                    ? "Current run rate (latest monthly burn)"
                    : "Historical trend (past cash movement continued)"}
                </Typography>
                <Typography variant="caption" sx={{ color: dashboardTokens.textMuted }}>
                  Baseline monthly movement: {formatCurrency(panel.baselineMonthlyMovement, result.currency)}
                </Typography>
                <Typography variant="body2" sx={{ color: dashboardTokens.textMuted, mt: 0.75 }}>
                  {panel.method === "current_run_rate"
                    ? `Shows what happens if the latest monthly burn of ${formatCurrency(Math.abs(panel.baselineMonthlyMovement ?? 0), result.currency)} continues every month.`
                    : `Shows what happens if the observed cash trend of ${formatCurrency(panel.baselineMonthlyMovement ?? 0, result.currency)} per month continues.`}
                </Typography>
                <Typography variant="caption" display="block" sx={{ color: dashboardTokens.textMuted, mt: 0.5 }}>
                  Value axis: Projected available liquidity ({result.currency}) · Time axis: Projection month
                </Typography>
                <Box sx={{ height: 290, mt: 1 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 12, right: 14, left: 8, bottom: 26 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={dashboardTokens.border} />
                      <XAxis dataKey="month" stroke={dashboardTokens.textMuted} style={{ fontSize: "0.7rem" }} />
                      <YAxis width={72} stroke={dashboardTokens.textMuted} style={{ fontSize: "0.7rem" }} tickFormatter={(value) => formatAxisNumber(Number(value), false)} />
                      <Legend />
                      <Tooltip
                        contentStyle={{ backgroundColor: dashboardTokens.surface, border: `1px solid ${dashboardTokens.border}`, borderRadius: 4 }}
                        formatter={(value, name) => [formatCurrency(Number(value), result.currency), panel.series.find((series) => series.id === name)?.label ?? name]}
                      />
                      {panel.series.map((series, index) => (
                        <Line
                          key={series.id}
                          type="monotone"
                          dataKey={series.id}
                          name={series.label}
                          stroke={SCENARIO_COLORS[index]}
                          strokeWidth={series.kind === "baseline" ? 2 : 2.5}
                          strokeDasharray={series.kind === "baseline" ? "6 4" : undefined}
                          dot={false}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </Box>
                <Stack spacing={0.75}>
                  {panel.series.map((series, index) => (
                    <Box key={series.id}>
                      <Stack direction="row" justifyContent="space-between" spacing={1}>
                        <Typography variant="caption" sx={{ color: SCENARIO_COLORS[index], fontWeight: 700 }}>{series.label}</Typography>
                        <Typography variant="caption" sx={{ color: dashboardTokens.textMuted, textAlign: "right" }}>
                          End {formatCurrency(series.summary.endingLiquidity, result.currency)} · {series.summary.cashOutMonth ? `cash-out ${series.summary.cashOutMonth}` : "no cash-out in horizon"}
                        </Typography>
                      </Stack>
                      <Typography variant="caption" display="block" sx={{ color: dashboardTokens.textMuted }}>
                        Change vs baseline {formatCurrency(series.summary.changeFromBaseline, result.currency)} · lowest {formatCurrency(series.summary.lowestLiquidity, result.currency)} · average monthly net movement {formatCurrency(series.summary.averageMonthlyNetMovement, result.currency)}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              </Paper>
            );
          })}
        </Box>

        <Box>
          <Typography variant="subtitle2" fontWeight={700}>Scenario assumptions</Typography>
          {result.input.scenarios.map((scenario) => (
            <Box key={scenario.id} sx={{ mt: 1, p: 1.25, border: "1px solid", borderColor: dashboardTokens.border, borderRadius: 1 }}>
              <Typography variant="body2" fontWeight={700}>{scenario.label}</Typography>
              {scenario.adjustments.map((adjustment) => {
                const resolved = result.panels.find((panel) => panel.available)?.series
                  .find((series) => series.id === scenario.id)?.resolvedAdjustments
                  .find((item) => item.id === adjustment.id);
                return <Typography key={adjustment.id} variant="caption" display="block" sx={{ color: dashboardTokens.textMuted }}>{resolved?.description ?? adjustment.label}</Typography>;
              })}
            </Box>
          ))}
        </Box>

        <Accordion disableGutters sx={{ bgcolor: "transparent", border: "1px solid", borderColor: dashboardTokens.border, "&:before": { display: "none" } }}>
          <AccordionSummary expandIcon={<ExpandMoreRoundedIcon />}>
            <Typography fontWeight={700}>View month-by-month values</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <TableContainer>
              <Table size="small" aria-label="Monthly scenario comparison">
                <TableHead><TableRow><TableCell>Method</TableCell><TableCell>Series</TableCell><TableCell>Month</TableCell><TableCell align="right">Liquidity</TableCell><TableCell align="right">Net movement</TableCell></TableRow></TableHead>
                <TableBody>
                  {result.panels.flatMap((panel) => panel.series.flatMap((series) => series.points.map((point) => (
                    <TableRow key={`${panel.method}-${series.id}-${point.month}`}>
                      <TableCell>{panel.label}</TableCell><TableCell>{series.label}</TableCell><TableCell>{point.month}</TableCell>
                      <TableCell align="right">{formatCurrency(point.value, result.currency)}</TableCell>
                      <TableCell align="right">{formatCurrency(point.netMovement, result.currency)}</TableCell>
                    </TableRow>
                  ))))}
                </TableBody>
              </Table>
            </TableContainer>
          </AccordionDetails>
        </Accordion>

        <Divider />
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} justifyContent="space-between" alignItems={{ sm: "center" }}>
          <Typography variant="caption" sx={{ color: dashboardTokens.textMuted }}>
            Deterministic model only. Review major decisions with a qualified professional.
          </Typography>
          <Button variant="outlined" onClick={openEditor}>Edit in Scenarios workspace</Button>
        </Stack>
      </Stack>
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
  const adjustedPercent =
    widget.data.workingCapitalAdjustedRunway === null ||
    widget.data.workingCapitalAdjustedRunway === undefined
      ? 0
      : Math.min(100, (widget.data.workingCapitalAdjustedRunway / 12) * 100);

  return (
    <WidgetFrame title={widget.title} reason={widget.reason}>
      <Stack spacing={1.25}>
        <Stack direction="row" justifyContent="space-between" spacing={1}>
          <Typography variant="body2" sx={{ color: dashboardTokens.textMuted }}>
            Cash runway
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
        <Stack direction="row" justifyContent="space-between" spacing={1}>
          <Typography variant="body2" sx={{ color: dashboardTokens.textMuted }}>
            Working-capital-adjusted runway
          </Typography>
          <Typography variant="body2" fontWeight={700} sx={{ color: "#22d3ee" }}>
            {widget.data.workingCapitalAdjustedRunway === null ||
            widget.data.workingCapitalAdjustedRunway === undefined
              ? "Unavailable"
              : `${formatNumber(widget.data.workingCapitalAdjustedRunway)} months`}
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
              width: `${Math.max(0, adjustedPercent)}%`,
              height: "100%",
              bgcolor: "#22d3ee",
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
  const tonePresentation = {
    available: { label: "available", color: "#bbf7d0", background: "rgba(34, 197, 94, 0.12)" },
    derived: { label: "calculated", color: "#bae6fd", background: "rgba(56, 189, 248, 0.12)" },
    unavailable: { label: "unavailable", color: "#fecdd3", background: "rgba(244, 63, 94, 0.12)" },
  } as const;
  const contextOnlyPresentation = {
    label: "context only",
    color: "#fde68a",
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
              {metricContextLabel(metric) ? (
                <Typography variant="caption" sx={{ color: "#bae6fd", display: "block", mt: 0.25 }}>
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
              <Typography variant="body2" sx={{ color: "common.white" }}>
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

function MetricTrendChartWidgetView({
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
        Value axis: <Box component="span" sx={{ color: "#bae6fd" }}>{isRunway ? "Runway (months)" : `${widget.data.label} (${widget.data.currency})`}</Box>
      </Typography>
      <Box sx={{ height: 250 }}>
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
                {runwaySeries.some((series) => series.variant === 'cash') ? <Line type="monotone" dataKey="cash" stroke="#4da6ff" strokeWidth={2} dot={{ fill: "#4da6ff", r: 4 }} connectNulls={false} /> : null}
                {runwaySeries.some((series) => series.variant === 'working_capital_adjusted') ? <Line type="monotone" dataKey="adjusted" stroke="#22d3ee" strokeWidth={2} dot={{ fill: "#22d3ee", r: 4 }} connectNulls={false} /> : null}
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
            <Legend verticalAlign="top" formatter={(value) => runwaySeries.length > 0 ? ({ cashActual: 'Cash runway', adjustedActual: 'Adjusted runway', cashForecast: 'Cash forecast', adjustedForecast: 'Adjusted forecast' }[String(value)] ?? value) : value === "actual" ? "Actual" : "Forecast"} />
            <Tooltip
              contentStyle={{ backgroundColor: dashboardTokens.surface, border: `1px solid ${dashboardTokens.border}`, borderRadius: 4, color: "white" }}
              formatter={(value, name) => [formatValue(Number(value)), runwaySeries.length > 0 ? ({ cashActual: 'Cash runway', adjustedActual: 'Adjusted runway', cashForecast: 'Cash forecast', adjustedForecast: 'Adjusted forecast' }[String(name)] ?? name) : name === "actual" ? "Actual" : "Forecast"]}
            />
            {runwaySeries.length > 0 ? <>
              {runwaySeries.some((series) => series.variant === 'cash') ? <><Line type="monotone" dataKey="cashActual" stroke="#4da6ff" strokeWidth={2} dot={{ fill: "#4da6ff", r: 4 }} connectNulls={false} /><Line type="monotone" dataKey="cashForecast" stroke="#4da6ff" strokeWidth={2} strokeDasharray="6 4" connectNulls={false} /></> : null}
              {runwaySeries.some((series) => series.variant === 'working_capital_adjusted') ? <><Line type="monotone" dataKey="adjustedActual" stroke="#22d3ee" strokeWidth={2} dot={{ fill: "#22d3ee", r: 4 }} connectNulls={false} /><Line type="monotone" dataKey="adjustedForecast" stroke="#22d3ee" strokeWidth={2} strokeDasharray="6 4" connectNulls={false} /></> : null}
            </> : <><Line type="monotone" dataKey="actual" stroke={color} strokeWidth={2} dot={{ fill: color, r: 4 }} connectNulls={false} /><Line type="monotone" dataKey="forecast" stroke="#fbbf24" strokeWidth={2} strokeDasharray="6 4" dot={{ fill: "#fbbf24", r: 4 }} connectNulls={false} /></>}
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
    case "scenario_analysis":
      return <ScenarioAnalysisWidgetView widget={widget} />;
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
  const documentReviewMode = plan?.workspaceMode === "document_review";
  const snapshotKey = plan?.documentReviewSnapshot?.documentIds.join("|") ?? null;
  const [documentReviewResolution, setDocumentReviewResolution] = useState<{
    snapshotKey: string;
    status: "changed" | "confirmed";
  } | null>(null);

  useEffect(() => {
    const snapshot = plan?.documentReviewSnapshot;

    if (!documentReviewMode || !snapshot) return;

    let cancelled = false;

    void fetch("/api/documents", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return null;
        return response.json() as Promise<{
          data?: {
            documents?: Array<{
              id: string;
              financial_review_status: "legacy" | "not_required" | "pending" | "confirmed";
            }>;
          };
        }>;
      })
      .then((payload) => {
        if (cancelled || !payload) return;

        const currentStatuses = (payload.data?.documents ?? [])
          .filter((document) => snapshot.documentIds.includes(document.id))
          .map((document) => document.financial_review_status);

        if (
          currentStatuses.length === 0 ||
          currentStatuses.every((status) => status === "pending")
        ) {
          return;
        }

        setDocumentReviewResolution({
          snapshotKey: snapshot.documentIds.join("|"),
          status: currentStatuses.every(
            (status) => status === "confirmed" || status === "not_required",
          )
            ? "confirmed"
            : "changed",
        });
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [documentReviewMode, snapshotKey, plan?.documentReviewSnapshot]);

  const historicalDocumentSnapshot =
    documentReviewMode &&
    snapshotKey !== null &&
    documentReviewResolution?.snapshotKey === snapshotKey;
  const documentReviewState = historicalDocumentSnapshot
    ? documentReviewResolution.status
    : "pending";
  const examplePrompts = historicalDocumentSnapshot
    ? HISTORICAL_DOCUMENT_PROMPTS
    : documentReviewMode
      ? DOCUMENT_REVIEW_PROMPTS
      : EXAMPLE_PROMPTS;
  const workspaceTitle = historicalDocumentSnapshot
    ? "Historical document evidence"
    : documentReviewMode
      ? "Document evidence workspace"
      : "Generated workspace";
  const workspaceSummary = historicalDocumentSnapshot
    ? documentReviewState === "confirmed"
      ? "This workspace was generated before the document became User-confirmed. The earlier answer remains unchanged; ask again for current calculations."
      : "The document review status has changed since this workspace was generated. Ask again to use the current state."
    : hasPlan
      ? plan?.summary
      : "Financial context generated from your current AI-BOSS conversation.";

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
                {workspaceTitle}
              </Typography>
              <Typography
                variant="body2"
                sx={{ color: dashboardTokens.textMuted }}
              >
                {workspaceSummary}
              </Typography>
            </Box>
          </Stack>
          <Chip
            label={historicalDocumentSnapshot ? "Historical snapshot" : documentReviewMode ? "Review required" : "Live"}
            size="small"
            sx={{
              height: 24,
              color: historicalDocumentSnapshot ? "#bae6fd" : documentReviewMode ? dashboardTokens.warning : dashboardTokens.positive,
              bgcolor: historicalDocumentSnapshot ? "rgba(56, 189, 248, 0.10)" : documentReviewMode ? "rgba(201, 129, 116, 0.10)" : "rgba(62, 180, 137, 0.10)",
              borderColor: historicalDocumentSnapshot ? "rgba(56, 189, 248, 0.22)" : documentReviewMode ? "rgba(201, 129, 116, 0.22)" : "rgba(62, 180, 137, 0.22)",
              borderRadius: `${dashboardTokens.radiusSm}px`,
              fontSize: 12,
              alignSelf: { xs: "flex-start", sm: "center" },
            }}
            variant="outlined"
          />
        </Stack>

        {historicalDocumentSnapshot ? (
          <Alert severity="info" sx={{ mb: 3 }}>
            This saved workspace reflects the review state at the time of the answer. It does not override the document&apos;s current status.
          </Alert>
        ) : null}

        {!documentReviewMode ? <>
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
              ? "Upload current records and confirm extracted values to complete the runway view."
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
        </> : null}

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
            {examplePrompts.map((prompt) => (
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
