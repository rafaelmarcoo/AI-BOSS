"use client";

import { Box, Chip, LinearProgress, Stack, Typography } from "@mui/material";
import { dashboardTokens } from "@/app/theme";
import type {
  CustomerConcentrationRiskWidget,
  CustomerRevenueBreakdownWidget,
  ProductServiceRevenueWidget,
} from "@/lib/gen-ui/types";
import { WidgetFrame } from "../../shared/WidgetFrame";
import { formatCurrency, formatDate } from "../../shared/formatting";

function EmptyMessage({ children }: { children: string }) {
  return <Typography variant="body2" sx={{ color: dashboardTokens.textMuted }}>{children}</Typography>;
}

function GroupHeader({
  sourceLabel,
  currency,
  periodStart,
  periodEnd,
  periodLabel,
}: {
  sourceLabel: string;
  currency: string;
  periodStart: string;
  periodEnd: string;
  periodLabel: string;
}) {
  return (
    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
      <Chip size="small" label={`${sourceLabel} · ${currency}`} />
      <Chip size="small" label={`${periodLabel}: ${formatDate(periodStart)}–${formatDate(periodEnd)}`} />
    </Stack>
  );
}

function RevenueRow({ name, revenue, percentage, currency }: { name: string; revenue: number; percentage: number | null; currency: string }) {
  const progress = percentage === null ? 0 : Math.min(100, Math.max(0, percentage));
  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" spacing={2}>
        <Typography variant="body2" noWrap sx={{ minWidth: 0 }}>{name}</Typography>
        <Typography variant="body2" fontWeight={700} sx={{ flexShrink: 0 }}>
          {formatCurrency(revenue, currency)}{percentage === null ? "" : ` · ${percentage.toFixed(1)}%`}
        </Typography>
      </Stack>
      <LinearProgress variant="determinate" value={progress} sx={{ mt: 0.5, height: 7, borderRadius: 4 }} />
    </Box>
  );
}

export function CustomerRevenueBreakdownWidgetView({ widget }: { widget: CustomerRevenueBreakdownWidget }) {
  return (
    <WidgetFrame title={widget.title} reason={widget.reason}>
      <Stack spacing={2}>
        {widget.data.groups.length === 0 ? <EmptyMessage>No recorded customer revenue falls in this period.</EmptyMessage> : widget.data.groups.map((group) => (
          <Box key={`${group.sourceLabel}:${group.currency}`}>
            <GroupHeader {...group} />
            <Typography variant="h5" fontWeight={750} sx={{ my: 1 }}>{formatCurrency(group.totalRevenue, group.currency)}</Typography>
            <Stack spacing={1.1}>
              {group.items.slice(0, 8).map((item) => (
                <RevenueRow key={item.customerId} name={item.customerName} revenue={item.revenue} percentage={item.percentage} currency={group.currency} />
              ))}
            </Stack>
            {group.unallocatedRevenue !== 0 ? (
              <Typography variant="caption" sx={{ color: dashboardTokens.textMuted, display: "block", mt: 1 }}>
                Unallocated: {formatCurrency(group.unallocatedRevenue, group.currency)}
              </Typography>
            ) : null}
            <Typography variant="caption" sx={{ color: dashboardTokens.textMuted }}>{group.rankingMethod}.</Typography>
          </Box>
        ))}
        <Typography variant="caption" sx={{ color: dashboardTokens.textMuted }}>{widget.data.note}</Typography>
      </Stack>
    </WidgetFrame>
  );
}

function ConcentrationMetric({ label, value }: { label: string; value: number | null }) {
  return (
    <Box>
      <Stack direction="row" justifyContent="space-between">
        <Typography variant="body2">{label}</Typography>
        <Typography variant="body2" fontWeight={700}>{value === null ? "Unavailable" : `${value.toFixed(1)}%`}</Typography>
      </Stack>
      <LinearProgress variant="determinate" value={value === null ? 0 : Math.min(100, Math.max(0, value))} sx={{ mt: 0.5, height: 7, borderRadius: 4 }} />
    </Box>
  );
}

export function CustomerConcentrationRiskWidgetView({ widget }: { widget: CustomerConcentrationRiskWidget }) {
  return (
    <WidgetFrame title={widget.title} reason={widget.reason}>
      <Stack spacing={2}>
        {widget.data.groups.length === 0 ? <EmptyMessage>No recorded customer revenue falls in this period.</EmptyMessage> : widget.data.groups.map((group) => (
          <Box key={`${group.sourceLabel}:${group.currency}`}>
            <GroupHeader {...group} />
            <Chip
              size="small"
              label={group.riskLevel === "unavailable" ? "Risk unavailable" : `${group.riskLevel} concentration`}
              color={group.riskLevel === "high" ? "error" : group.riskLevel === "elevated" ? "warning" : "default"}
              sx={{ my: 1 }}
            />
            <Stack spacing={1.2}>
              <ConcentrationMetric label="Largest customer" value={group.topCustomerPercentage} />
              <ConcentrationMetric label="Top 3 customers" value={group.topThreePercentage} />
              <ConcentrationMetric label="Top 5 customers" value={group.topFivePercentage} />
            </Stack>
            {group.unallocatedRevenue !== 0 ? (
              <Typography variant="caption" sx={{ color: dashboardTokens.textMuted, display: "block", mt: 1 }}>
                Unallocated revenue: {formatCurrency(group.unallocatedRevenue, group.currency)}.
              </Typography>
            ) : null}
            <Typography variant="caption" sx={{ color: dashboardTokens.textMuted, display: "block", mt: 0.75 }}>
              Elevated: {group.thresholds.elevated}. High: {group.thresholds.high}.
            </Typography>
          </Box>
        ))}
        <Typography variant="caption" sx={{ color: dashboardTokens.textMuted }}>{widget.data.note}</Typography>
      </Stack>
    </WidgetFrame>
  );
}

export function ProductServiceRevenueWidgetView({ widget }: { widget: ProductServiceRevenueWidget }) {
  return (
    <WidgetFrame title={widget.title} reason={widget.reason}>
      <Stack spacing={2}>
        {widget.data.groups.length === 0 ? <EmptyMessage>{widget.data.note}</EmptyMessage> : widget.data.groups.map((group) => (
          <Box key={`${group.sourceLabel}:${group.currency}:${group.dimensionGroup}`}>
            <GroupHeader {...group} />
            {group.dimensionGroup !== "default" ? <Chip size="small" label={group.dimensionGroup} sx={{ mt: 1 }} /> : null}
            <Typography variant="h5" fontWeight={750} sx={{ my: 1 }}>{formatCurrency(group.totalRevenue, group.currency)}</Typography>
            <Stack spacing={1.1}>
              {group.items.slice(0, 8).map((item) => (
                <RevenueRow key={item.dimensionId} name={item.name} revenue={item.revenue} percentage={item.percentage} currency={group.currency} />
              ))}
            </Stack>
            {group.unallocatedRevenue !== 0 ? (
              <Typography variant="caption" sx={{ color: dashboardTokens.textMuted, display: "block", mt: 1 }}>
                Unallocated: {formatCurrency(group.unallocatedRevenue, group.currency)}
              </Typography>
            ) : null}
          </Box>
        ))}
        {widget.data.groups.length > 0 ? <Typography variant="caption" sx={{ color: dashboardTokens.textMuted }}>{widget.data.note}</Typography> : null}
      </Stack>
    </WidgetFrame>
  );
}
