"use client";

import { Box, Chip, Stack, Typography } from "@mui/material";
import { dashboardCanvasTokens as dashboardTokens } from "@/app/theme";
import type {
  AccountsPayableWidget as AccountsPayableWidgetModel,
  AccountsReceivableWidget as AccountsReceivableWidgetModel,
  AiFinancialBriefWidget as AiFinancialBriefWidgetModel,
  CashBalanceWidget as CashBalanceWidgetModel,
  ExpenseSummaryWidget as ExpenseSummaryWidgetModel,
  ExpenseTrendWidget as ExpenseTrendWidgetModel,
  RevenueGrowthWidget as RevenueGrowthWidgetModel,
  RevenueSnapshotWidget as RevenueSnapshotWidgetModel,
  RevenueTrendWidget as RevenueTrendWidgetModel,
} from "@/lib/gen-ui/types";
import { KpiWidget } from "../../primitives/KpiWidget";
import { NarrativeWidget } from "../../primitives/NarrativeWidget";
import { TrendChartWidget } from "../../primitives/TrendChartWidget";
import { WidgetFrame } from "../../shared/WidgetFrame";
import { formatCurrency, formatDate } from "../../shared/formatting";

export function CashBalanceWidgetView({ widget }: { widget: CashBalanceWidgetModel }) {
  return <KpiWidget title={widget.title} reason={widget.reason} data={widget.data} accent={dashboardTokens.positive} />;
}

export function RevenueSnapshotWidgetView({ widget }: { widget: RevenueSnapshotWidgetModel }) {
  return <KpiWidget title={widget.title} reason={widget.reason} data={widget.data} accent={dashboardTokens.positive} />;
}

export function ExpenseSummaryWidgetView({ widget }: { widget: ExpenseSummaryWidgetModel }) {
  return <KpiWidget title={widget.title} reason={widget.reason} data={widget.data} accent={dashboardTokens.negative} />;
}

export function AccountsReceivableWidgetView({ widget }: { widget: AccountsReceivableWidgetModel }) {
  return <KpiWidget title={widget.title} reason={widget.reason} data={widget.data} accent={dashboardTokens.info} />;
}

export function AccountsPayableWidgetView({ widget }: { widget: AccountsPayableWidgetModel }) {
  return <KpiWidget title={widget.title} reason={widget.reason} data={widget.data} accent="#9B451C" />;
}

export function RevenueTrendWidgetView({ widget }: { widget: RevenueTrendWidgetModel }) {
  return <TrendChartWidget title={widget.title} reason={widget.reason} data={widget.data} accent={dashboardTokens.positive} />;
}

export function ExpenseTrendWidgetView({ widget }: { widget: ExpenseTrendWidgetModel }) {
  return <TrendChartWidget title={widget.title} reason={widget.reason} data={widget.data} accent={dashboardTokens.negative} />;
}

export function RevenueGrowthWidgetView({ widget }: { widget: RevenueGrowthWidgetModel }) {
  const color = widget.data.direction === "up"
    ? dashboardTokens.positive
    : widget.data.direction === "down"
      ? dashboardTokens.warning
      : dashboardTokens.textSoft;
  const growth = widget.data.growthPercentage === null
    ? "Unavailable"
    : `${widget.data.growthPercentage > 0 ? "+" : ""}${widget.data.growthPercentage.toFixed(1)}%`;

  return (
    <WidgetFrame title={widget.title} reason={widget.reason}>
      <Stack spacing={1.5}>
        <Typography sx={{ fontSize: { xs: 30, sm: 36 }, fontWeight: 700, color }}>{growth}</Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Chip label={`Current: ${formatCurrency(widget.data.currentValue, widget.data.currency)}`} size="small" />
          <Chip label={`Previous: ${formatCurrency(widget.data.previousValue, widget.data.currency)}`} size="small" />
        </Stack>
        <Box>
          <Typography variant="caption" display="block" sx={{ color: dashboardTokens.textMuted }}>
            {widget.data.previousPeriod ? formatDate(widget.data.previousPeriod) : "Previous period unavailable"}
            {" → "}
            {widget.data.currentPeriod ? formatDate(widget.data.currentPeriod) : "Current period unavailable"}
          </Typography>
          <Typography variant="caption" sx={{ color: dashboardTokens.textMuted }}>
            Sources: {widget.data.sourceLabels.join(", ") || "Unavailable"}
          </Typography>
        </Box>
      </Stack>
    </WidgetFrame>
  );
}

export function AiFinancialBriefWidgetView({ widget }: { widget: AiFinancialBriefWidgetModel }) {
  return <NarrativeWidget widget={widget} />;
}
