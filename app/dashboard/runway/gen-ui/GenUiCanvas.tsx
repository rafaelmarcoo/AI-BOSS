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
import HighlightAltRoundedIcon from "@mui/icons-material/HighlightAltRounded";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
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
  MissingDataPanelWidget as MissingDataPanelWidgetModel,
  PlanningChecklistWidget as PlanningChecklistWidgetModel,
  RiskThresholdTimelineWidget as RiskThresholdTimelineWidgetModel,
  RunwayTrendChartWidget as RunwayTrendChartWidgetModel,
  ScenarioComparisonWidget as ScenarioComparisonWidgetModel,
} from "@/lib/gen-ui/types";

type AskChatbotMode = "selection" | "prompt";

interface GenUiCanvasProps {
  plan: GenUiPlan | null;
  baselineSummary: string;
  onAskChatbot: (text: string, mode?: AskChatbotMode) => void;
}

const EXAMPLE_PROMPTS = [
  "Plan the next 6 months from my current runway.",
  "What happens if monthly burn increases by 15%?",
  "When do I hit 3 months of runway?",
  "Which costs should I review first?",
  "Show me a future cash and runway trend.",
];

function formatCurrency(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return "-";
  }

  return new Intl.NumberFormat("en-NZ", {
    style: "currency",
    currency: "NZD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatNumber(value: number | null | undefined, decimals = 1) {
  if (value === null || value === undefined) {
    return "-";
  }

  return value.toFixed(decimals);
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
        borderRadius: 1,
        bgcolor: "rgba(255, 255, 255, 0.028)",
        border: "1px solid",
        borderColor: dashboardTokens.border,
        color: "common.white",
        minWidth: 0,
      }}
    >
      <Stack spacing={1.75}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1}
          justifyContent="space-between"
        >
          <Typography variant="subtitle1" fontWeight={700}>
            {title}
          </Typography>
          <Chip
            label="AI-selected"
            size="small"
            sx={{
              color: "#bae6fd",
              bgcolor: "rgba(14, 165, 233, 0.10)",
              borderColor: "rgba(125, 211, 252, 0.22)",
              alignSelf: { xs: "flex-start", sm: "center" },
            }}
            variant="outlined"
          />
        </Stack>
        <Typography variant="body2" sx={{ color: dashboardTokens.textMuted }}>
          {reason}
        </Typography>
        {children}
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

function RunwayTrendWidgetView({
  widget,
}: {
  widget: RunwayTrendChartWidgetModel;
}) {
  const data = widget.data.points.map((point) => ({
    ...point,
    runway: point.runwayMonths,
  }));

  return (
    <WidgetFrame title={widget.title} reason={widget.reason}>
      <Box sx={{ height: 260, minWidth: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 18, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={dashboardTokens.border} />
            <XAxis
              dataKey="label"
              stroke={dashboardTokens.textMuted}
              style={{ fontSize: "0.75rem" }}
            />
            <YAxis
              stroke={dashboardTokens.textMuted}
              style={{ fontSize: "0.75rem" }}
              width={34}
              tickFormatter={(value) => `${value}m`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: dashboardTokens.surface,
                border: `1px solid ${dashboardTokens.border}`,
                borderRadius: 4,
                color: "white",
              }}
              labelStyle={{ color: "white" }}
              formatter={(value, _name, item) => [
                `${formatNumber(value as number)} months`,
                item.payload.kind === "actual" ? "Actual" : "Forecast",
              ]}
            />
            <Line
              type="monotone"
              dataKey="runway"
              stroke="#38bdf8"
              strokeWidth={2.5}
              dot={{ fill: "#020617", stroke: "#67e8f9", strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </Box>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        <Chip
          label={`Current ${formatNumber(widget.data.currentRunway)} mo`}
          size="small"
          sx={{ color: "#bbf7d0", bgcolor: "rgba(34, 197, 94, 0.12)" }}
        />
        <Chip
          label={`Trend ${widget.data.direction.replace("_", " ")}`}
          size="small"
          sx={{ color: "#bae6fd", bgcolor: "rgba(14, 165, 233, 0.12)" }}
        />
        <Chip
          label={`Caution < ${widget.data.cautionThreshold} mo`}
          size="small"
          sx={{ color: "#fde68a", bgcolor: "rgba(251, 191, 36, 0.12)" }}
        />
        <Chip
          label={`Urgent < ${widget.data.urgentThreshold} mo`}
          size="small"
          sx={{ color: "#fecdd3", bgcolor: "rgba(251, 113, 133, 0.12)" }}
        />
      </Stack>
      <Typography variant="caption" sx={{ color: dashboardTokens.textMuted }}>
        {widget.data.note}
      </Typography>
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
                  {formatCurrency(row.monthlyBurn)} burn
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
    case "runway_trend_chart":
      return <RunwayTrendWidgetView widget={widget} />;
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
  onAskChatbot,
}: GenUiCanvasProps) {
  const hasPlan = Boolean(plan && plan.widgets.length > 0);

  return (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 2.25, sm: 2.75 },
        borderRadius: 1,
        bgcolor: "rgba(15, 23, 42, 0.62)",
        color: "common.white",
        border: "1px solid",
        borderColor: "rgba(125, 211, 252, 0.16)",
        overflow: "hidden",
      }}
    >
      <Stack spacing={2.5}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          alignItems={{ xs: "flex-start", sm: "center" }}
          justifyContent="space-between"
          spacing={1.5}
        >
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Box
              sx={{
                width: 38,
                height: 38,
                borderRadius: 1,
                bgcolor: "rgba(20, 184, 166, 0.14)",
                color: "#5eead4",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flex: "0 0 auto",
              }}
            >
              {plan?.source === "selection" ? (
                <HighlightAltRoundedIcon fontSize="small" />
              ) : (
                <TrendingUpIcon fontSize="small" />
              )}
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="subtitle1" fontWeight={700}>
                Generated workspace
              </Typography>
              <Typography
                variant="body2"
                sx={{ color: dashboardTokens.textMuted }}
              >
                {hasPlan
                  ? plan?.summary
                  : "Ready to build a workspace from your next AI-BOSS question."}
              </Typography>
            </Box>
          </Stack>
          <Chip
            label={hasPlan ? "Live plan" : "Ready"}
            size="small"
            sx={{
              color: hasPlan ? "#bbf7d0" : "#bae6fd",
              bgcolor: hasPlan
                ? "rgba(34, 197, 94, 0.12)"
                : "rgba(14, 165, 233, 0.12)",
              borderColor: "rgba(125, 211, 252, 0.24)",
              alignSelf: { xs: "flex-start", sm: "center" },
            }}
            variant="outlined"
          />
        </Stack>

        <Paper
          elevation={0}
          sx={{
            p: 2.25,
            borderRadius: 1,
            bgcolor: "rgba(37, 99, 235, 0.08)",
            border: "1px solid",
            borderColor: "rgba(96, 165, 250, 0.25)",
          }}
        >
          <Stack spacing={1}>
            <Stack direction="row" spacing={1} alignItems="center">
              <HighlightAltRoundedIcon sx={{ color: "#93c5fd", fontSize: 18 }} />
              <Typography variant="caption" sx={{ color: "#bfdbfe" }}>
                Runway summary · highlight any workspace text to ask AI-BOSS
              </Typography>
            </Stack>
            <Typography
              variant="body2"
              sx={{ color: "common.white", lineHeight: 1.8, userSelect: "text" }}
            >
              {baselineSummary}
            </Typography>
          </Stack>
        </Paper>

        {hasPlan ? (
          <Box
            sx={{
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
              p: 2,
              borderRadius: 1,
              bgcolor: "rgba(255, 255, 255, 0.028)",
              border: "1px solid",
              borderColor: dashboardTokens.border,
            }}
          >
            <Stack spacing={1.5}>
              <Typography variant="subtitle2" fontWeight={700}>
                No generated widgets selected yet
              </Typography>
              <Typography variant="body2" sx={{ color: dashboardTokens.textMuted }}>
                Ask AI-BOSS a runway, metric, source, scenario, or planning question.
                Only the widgets relevant to that request will appear here.
              </Typography>
            </Stack>
          </Paper>
        )}

        <Stack spacing={1}>
          <Typography variant="subtitle2" fontWeight={700}>
            Example prompts for testing
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {EXAMPLE_PROMPTS.map((prompt) => (
              <Button
                key={prompt}
                size="small"
                variant="outlined"
                onClick={() => onAskChatbot(prompt, "prompt")}
                sx={{
                  borderRadius: 999,
                  color: "common.white",
                  borderColor: dashboardTokens.borderMuted,
                  textTransform: "none",
                  maxWidth: { xs: "100%", sm: "none" },
                  whiteSpace: "normal",
                  textAlign: "left",
                  "&:hover": {
                    borderColor: "rgba(125, 211, 252, 0.42)",
                    bgcolor: "rgba(14, 165, 233, 0.10)",
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
