"use client";

import { Box, Chip, LinearProgress, Stack, Typography } from "@mui/material";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { dashboardTokens } from "@/app/theme";
import type {
  BreakEvenAnalysisWidget,
  BreakEvenProgressWidget,
  BudgetForecastWidget,
  BudgetRemainingWidget,
  BudgetVsActualWidget,
  CashFlowForecastWidget,
  CashFlowSummaryWidget,
  CashInflowForecastWidget,
  CashOutflowForecastWidget,
  ExpenseBreakdownWidget,
  ExpenseChangeDetectorWidget,
  FinancialForecastData,
  FinancialSummaryData,
  LargestExpensesWidget,
  ProfitForecastWidget,
  ProfitMarginWidget,
  ProfitSnapshotWidget,
  ProfitTrendWidget,
  RevenueForecastWidget,
} from "@/lib/gen-ui/types";
import { WidgetFrame } from "../../shared/WidgetFrame";
import { formatAxisDate, formatAxisNumber, formatCurrency, formatDate } from "../../shared/formatting";

function SummaryView({ title, reason, data }: { title: string; reason: string; data: FinancialSummaryData }) {
  return (
    <WidgetFrame title={title} reason={reason}>
      <Stack spacing={1.5}>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Chip size="small" label={`Currency: ${data.currency ?? "Unavailable"}`} />
          <Chip size="small" label={data.periodEnd ? `Period end: ${formatDate(data.periodEnd)}` : "Period unavailable"} />
          <Chip size="small" label={`Source: ${data.sourceLabel}`} />
        </Stack>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(3, minmax(0, 1fr))" }, gap: 1 }}>
          {data.metrics.map((metric) => (
            <Box key={metric.label} sx={{ p: 1.25, bgcolor: "rgba(255,255,255,0.025)", borderLeft: "3px solid", borderColor: metric.tone === "positive" ? dashboardTokens.positive : metric.tone === "warning" ? dashboardTokens.warning : dashboardTokens.border }}>
              <Typography variant="caption" sx={{ color: dashboardTokens.textMuted }}>{metric.label}</Typography>
              <Typography fontWeight={700} sx={{ mt: 0.25 }}>
                {metric.percentage !== undefined && metric.percentage !== null
                  ? `${metric.percentage.toFixed(1)}%`
                  : formatCurrency(metric.value, data.currency)}
              </Typography>
              {metric.comparisonPercentage !== undefined && metric.comparisonPercentage !== null ? (
                <Typography variant="caption" sx={{ color: metric.comparisonPercentage >= 0 ? dashboardTokens.positive : dashboardTokens.warning }}>
                  {metric.comparisonPercentage >= 0 ? "+" : ""}{metric.comparisonPercentage.toFixed(1)} pp {metric.comparisonLabel ?? "vs previous period"}
                </Typography>
              ) : null}
            </Box>
          ))}
        </Box>
        <Typography variant="caption" sx={{ color: dashboardTokens.textMuted }}>{data.note}</Typography>
      </Stack>
    </WidgetFrame>
  );
}

function ForecastView({ title, reason, data }: { title: string; reason: string; data: FinancialForecastData }) {
  const lastActualIndex = data.actualPoints.length - 1;
  const chartData = [
    ...data.actualPoints.map((point, index) => ({
      date: point.date,
      actual: point.value,
      forecast: index === lastActualIndex && data.forecastPoints.length > 0 ? point.value : null,
    })),
    ...data.forecastPoints.map((point) => ({ date: point.date, actual: null, forecast: point.value })),
  ];
  return (
    <WidgetFrame title={title} reason={reason}>
      <Stack spacing={1.5}>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Chip size="small" label={`Currency: ${data.currency ?? "Unavailable"}`} />
          <Chip size="small" label="Actual" sx={{ color: dashboardTokens.positive }} />
          {data.forecastPoints.length > 0 ? <Chip size="small" label="Forecast" sx={{ color: "#38bdf8" }} /> : null}
        </Stack>
        <Box sx={{ width: "100%", height: 260, minWidth: 0, overflow: "hidden" }}>
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={180} initialDimension={{ width: 500, height: 260 }}>
            <LineChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
              <CartesianGrid stroke="rgba(148,163,184,0.14)" strokeDasharray="3 3" />
              <XAxis dataKey="date" tickFormatter={formatAxisDate} stroke={dashboardTokens.textMuted} />
              <YAxis tickFormatter={(value) => formatAxisNumber(Number(value), false)} stroke={dashboardTokens.textMuted} />
              <Tooltip formatter={(value) => formatCurrency(Number(value), data.currency)} labelFormatter={(label) => formatAxisDate(String(label))} />
              <Line type="monotone" dataKey="actual" name="Actual" stroke={dashboardTokens.positive} strokeWidth={2.5} connectNulls />
              <Line type="monotone" dataKey="forecast" name="Forecast" stroke="#38bdf8" strokeWidth={2.5} strokeDasharray="6 5" connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </Box>
        <Typography variant="caption" sx={{ color: dashboardTokens.textMuted }}>
          Method: {data.method}. {data.assumptions.join(" ")}
        </Typography>
      </Stack>
    </WidgetFrame>
  );
}

export const CashFlowSummaryWidgetView = ({ widget }: { widget: CashFlowSummaryWidget }) => <SummaryView title={widget.title} reason={widget.reason} data={widget.data} />;
export const ProfitSnapshotWidgetView = ({ widget }: { widget: ProfitSnapshotWidget }) => <SummaryView title={widget.title} reason={widget.reason} data={widget.data} />;
export const ProfitMarginWidgetView = ({ widget }: { widget: ProfitMarginWidget }) => <SummaryView title={widget.title} reason={widget.reason} data={widget.data} />;
export const CashFlowForecastWidgetView = ({ widget }: { widget: CashFlowForecastWidget }) => <ForecastView title={widget.title} reason={widget.reason} data={widget.data} />;
export const RevenueForecastWidgetView = ({ widget }: { widget: RevenueForecastWidget }) => <ForecastView title={widget.title} reason={widget.reason} data={widget.data} />;
export const ProfitTrendWidgetView = ({ widget }: { widget: ProfitTrendWidget }) => <ForecastView title={widget.title} reason={widget.reason} data={widget.data} />;
export const ProfitForecastWidgetView = ({ widget }: { widget: ProfitForecastWidget }) => <ForecastView title={widget.title} reason={widget.reason} data={widget.data} />;
export const CashInflowForecastWidgetView = ({ widget }: { widget: CashInflowForecastWidget }) => <ForecastView title={widget.title} reason={widget.reason} data={widget.data} />;
export const CashOutflowForecastWidgetView = ({ widget }: { widget: CashOutflowForecastWidget }) => <ForecastView title={widget.title} reason={widget.reason} data={widget.data} />;

export function BreakEvenAnalysisWidgetView({ widget }: { widget: BreakEvenAnalysisWidget }) {
  return (
    <WidgetFrame title={widget.title} reason={widget.reason}>
      <Stack spacing={1.25}>
        <Typography sx={{ fontSize: 30, fontWeight: 700, color: dashboardTokens.positive }}>
          {formatCurrency(widget.data.breakEvenRevenue, widget.data.currency)}
        </Typography>
        <Typography variant="body2">Required break-even revenue</Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Chip size="small" label={`Fixed: ${formatCurrency(widget.data.fixedCosts, widget.data.currency)}`} />
          <Chip size="small" label={`Variable: ${formatCurrency(widget.data.variableCosts, widget.data.currency)}`} />
          <Chip size="small" label={`Contribution margin: ${widget.data.contributionMarginPercentage?.toFixed(1) ?? "—"}%`} />
        </Stack>
        <Typography variant="caption" sx={{ color: dashboardTokens.textMuted }}>{widget.data.note}</Typography>
      </Stack>
    </WidgetFrame>
  );
}

export function BreakEvenProgressWidgetView({ widget }: { widget: BreakEvenProgressWidget }) {
  const progress = Math.max(0, Math.min(100, widget.data.progressPercentage ?? 0));
  return (
    <WidgetFrame title={widget.title} reason={widget.reason}>
      <Stack spacing={1.25}>
        <Typography sx={{ fontSize: 30, fontWeight: 700 }}>{widget.data.progressPercentage?.toFixed(1) ?? "—"}%</Typography>
        <LinearProgress variant="determinate" value={progress} sx={{ height: 10, borderRadius: 5 }} />
        <Typography variant="body2">Remaining: {formatCurrency(widget.data.remainingRevenue, widget.data.currency)}</Typography>
        <Typography variant="caption" sx={{ color: dashboardTokens.textMuted }}>{widget.data.note}</Typography>
      </Stack>
    </WidgetFrame>
  );
}

export function ExpenseBreakdownWidgetView({ widget }: { widget: ExpenseBreakdownWidget }) {
  return (
    <WidgetFrame title={widget.title} reason={widget.reason}>
      <Stack spacing={1.25}>
        {widget.data.categories.map((category) => (
          <Box key={category.label}>
            <Stack direction="row" justifyContent="space-between" spacing={1}>
              <Typography variant="body2">{category.label}</Typography>
              <Typography variant="body2" fontWeight={700}>{formatCurrency(category.amount, widget.data.currency)} · {category.percentage.toFixed(1)}%</Typography>
            </Stack>
            <LinearProgress variant="determinate" value={Math.min(100, category.percentage)} sx={{ mt: 0.5, height: 6 }} />
          </Box>
        ))}
      </Stack>
    </WidgetFrame>
  );
}

export function LargestExpensesWidgetView({ widget }: { widget: LargestExpensesWidget }) {
  return (
    <WidgetFrame title={widget.title} reason={widget.reason}>
      <Stack spacing={1}>
        {widget.data.items.map((item, index) => (
          <Stack key={item.id} direction="row" justifyContent="space-between" spacing={2} sx={{ pb: 1, borderBottom: "1px solid", borderColor: dashboardTokens.border }}>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body2" fontWeight={700}>{index + 1}. {item.counterparty ?? item.label}</Typography>
              <Typography variant="caption" sx={{ color: dashboardTokens.textMuted }}>{formatDate(item.date)}{item.category ? ` · ${item.category}` : ""}</Typography>
            </Box>
            <Typography variant="body2" fontWeight={700}>{formatCurrency(item.amount, widget.data.currency)}</Typography>
          </Stack>
        ))}
      </Stack>
    </WidgetFrame>
  );
}

export function ExpenseChangeDetectorWidgetView({ widget }: { widget: ExpenseChangeDetectorWidget }) {
  return (
    <WidgetFrame title={widget.title} reason={widget.reason}>
      <Stack spacing={1}>
        {widget.data.changes.map((change) => (
          <Stack key={change.category} direction="row" justifyContent="space-between" spacing={2}>
            <Box><Typography variant="body2" fontWeight={700}>{change.category}</Typography><Typography variant="caption" sx={{ color: dashboardTokens.textMuted }}>Previous {formatCurrency(change.previousAmount, widget.data.currency)}</Typography></Box>
            <Typography variant="body2" fontWeight={700} sx={{ color: change.change > 0 ? dashboardTokens.warning : dashboardTokens.positive }}>
              {change.change > 0 ? "+" : ""}{formatCurrency(change.change, widget.data.currency)}{change.percentageChange === null ? "" : ` (${change.percentageChange > 0 ? "+" : ""}${change.percentageChange.toFixed(1)}%)`}
            </Typography>
          </Stack>
        ))}
      </Stack>
    </WidgetFrame>
  );
}

type BudgetWidget = BudgetVsActualWidget | BudgetRemainingWidget | BudgetForecastWidget;
function BudgetView({ widget }: { widget: BudgetWidget }) {
  return (
    <WidgetFrame title={widget.title} reason={widget.reason}>
      <Stack spacing={1.25}>
        <Typography variant="body2" fontWeight={700}>{widget.data.budgetName}</Typography>
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 1 }}>
          <Box><Typography variant="caption" sx={{ color: dashboardTokens.textMuted }}>Budget</Typography><Typography fontWeight={700}>{formatCurrency(widget.data.totalBudget, widget.data.currency)}</Typography></Box>
          <Box><Typography variant="caption" sx={{ color: dashboardTokens.textMuted }}>Actual</Typography><Typography fontWeight={700}>{formatCurrency(widget.data.totalActual, widget.data.currency)}</Typography></Box>
          <Box><Typography variant="caption" sx={{ color: dashboardTokens.textMuted }}>Remaining</Typography><Typography fontWeight={700}>{formatCurrency(widget.data.totalRemaining, widget.data.currency)}</Typography></Box>
          <Box><Typography variant="caption" sx={{ color: dashboardTokens.textMuted }}>Projected variance</Typography><Typography fontWeight={700}>{formatCurrency(widget.data.projectedVariance, widget.data.currency)}</Typography></Box>
        </Box>
        <Typography variant="caption" sx={{ color: dashboardTokens.textMuted }}>{widget.data.periodStart && widget.data.periodEnd ? `${formatDate(widget.data.periodStart)}–${formatDate(widget.data.periodEnd)}` : "Budget period unavailable"}</Typography>
        {widget.type === "budget_forecast" ? (
          <Typography variant="caption" sx={{ color: dashboardTokens.textMuted }}>
            Method: {widget.data.method}. {widget.data.assumptions.join(" ")}
          </Typography>
        ) : null}
      </Stack>
    </WidgetFrame>
  );
}
export const BudgetVsActualWidgetView = ({ widget }: { widget: BudgetVsActualWidget }) => <BudgetView widget={widget} />;
export const BudgetRemainingWidgetView = ({ widget }: { widget: BudgetRemainingWidget }) => <BudgetView widget={widget} />;
export const BudgetForecastWidgetView = ({ widget }: { widget: BudgetForecastWidget }) => <BudgetView widget={widget} />;
