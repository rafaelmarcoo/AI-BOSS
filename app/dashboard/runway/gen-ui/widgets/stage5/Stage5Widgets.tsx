"use client";

import { Box, Chip, LinearProgress, Stack, Typography } from "@mui/material";
import { dashboardCanvasTokens as dashboardTokens } from "@/app/theme";
import type {
  AssetSummaryWidget,
  BalanceSheetCategoryGroupData,
  BalanceSheetMetricGroupData,
  CurrentRatioWidget,
  DebtOverviewWidget,
  DebtRepaymentTimelineWidget,
  EquitySnapshotWidget,
  LiabilitySummaryWidget,
  QuickRatioWidget,
  WorkingCapitalWidget,
} from "@/lib/gen-ui/types";
import { WidgetFrame } from "../../shared/WidgetFrame";
import { formatCurrency, formatDate } from "../../shared/formatting";

function EmptyMessage({ children }: { children: string }) {
  return <Typography variant="body2" sx={{ color: dashboardTokens.textMuted }}>{children}</Typography>;
}

function SourceHeader({ sourceLabel, currency, asOfDate }: Pick<BalanceSheetMetricGroupData, "sourceLabel" | "currency" | "asOfDate">) {
  return (
    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
      <Chip size="small" label={`${sourceLabel} · ${currency}`} />
      <Chip size="small" label={`As of ${formatDate(asOfDate)}`} />
    </Stack>
  );
}

function BalanceMetricView({
  title,
  reason,
  groups,
  formula,
  note,
  metric,
}: {
  title: string;
  reason: string;
  groups: BalanceSheetMetricGroupData[];
  formula: string;
  note: string;
  metric: "workingCapital" | "currentRatio" | "quickRatio";
}) {
  return (
    <WidgetFrame title={title} reason={reason}>
      <Stack spacing={1.75}>
        {groups.length === 0 ? <EmptyMessage>No classified balance sheet is available.</EmptyMessage> : groups.map((group) => {
          const value = group[metric];
          const unavailableQuick = metric === "quickRatio" && group.quickRatioStatus === "unclassified_current_assets";
          return (
            <Box key={`${group.sourceLabel}:${group.currency}`}>
              <SourceHeader {...group} />
              <Typography variant="h4" fontWeight={750} sx={{ mt: 1 }}>
                {value === null
                  ? "Unavailable"
                  : metric === "workingCapital"
                    ? formatCurrency(value, group.currency)
                    : `${value.toFixed(2)}×`}
              </Typography>
              <Typography variant="body2" sx={{ color: dashboardTokens.textMuted }}>
                Current assets {formatCurrency(group.currentAssets, group.currency)} · Current liabilities {formatCurrency(group.currentLiabilities, group.currency)}
              </Typography>
              {unavailableQuick ? (
                <Typography variant="caption" sx={{ color: dashboardTokens.textMuted }}>
                  {group.unclassifiedQuickAssetCount} current-asset line{group.unclassifiedQuickAssetCount === 1 ? " needs" : "s need"} explicit include/exclude treatment.
                </Typography>
              ) : null}
            </Box>
          );
        })}
        <Typography variant="caption" sx={{ color: dashboardTokens.textMuted }}>Formula: {formula}.</Typography>
        <Typography variant="caption" sx={{ color: dashboardTokens.textMuted }}>{note}</Typography>
      </Stack>
    </WidgetFrame>
  );
}

export const WorkingCapitalWidgetView = ({ widget }: { widget: WorkingCapitalWidget }) => (
  <BalanceMetricView {...widget.data} title={widget.title} reason={widget.reason} metric="workingCapital" />
);
export const CurrentRatioWidgetView = ({ widget }: { widget: CurrentRatioWidget }) => (
  <BalanceMetricView {...widget.data} title={widget.title} reason={widget.reason} metric="currentRatio" />
);
export const QuickRatioWidgetView = ({ widget }: { widget: QuickRatioWidget }) => (
  <BalanceMetricView {...widget.data} title={widget.title} reason={widget.reason} metric="quickRatio" />
);

function CategorySummaryView({
  title,
  reason,
  groups,
  note,
  emptyLabel,
}: {
  title: string;
  reason: string;
  groups: BalanceSheetCategoryGroupData[];
  note: string;
  emptyLabel: string;
}) {
  return (
    <WidgetFrame title={title} reason={reason}>
      <Stack spacing={2}>
        {groups.length === 0 ? <EmptyMessage>{emptyLabel}</EmptyMessage> : groups.map((group) => (
          <Box key={`${group.sourceLabel}:${group.currency}`}>
            <SourceHeader {...group} />
            <Typography variant="h5" fontWeight={750} sx={{ my: 1 }}>{formatCurrency(group.total, group.currency)}</Typography>
            <Stack spacing={1}>
              {group.items.map((item) => (
                <Box key={item.category}>
                  <Stack direction="row" justifyContent="space-between" spacing={2}>
                    <Typography variant="body2">{item.label}</Typography>
                    <Typography variant="body2" fontWeight={700}>{formatCurrency(item.amount, group.currency)}</Typography>
                  </Stack>
                  <LinearProgress variant="determinate" value={item.percentage} sx={{ mt: 0.4, height: 6, borderRadius: 3 }} />
                </Box>
              ))}
            </Stack>
          </Box>
        ))}
        <Typography variant="caption" sx={{ color: dashboardTokens.textMuted }}>{note}</Typography>
      </Stack>
    </WidgetFrame>
  );
}

export const AssetSummaryWidgetView = ({ widget }: { widget: AssetSummaryWidget }) => (
  <CategorySummaryView {...widget.data} title={widget.title} reason={widget.reason} emptyLabel="No classified assets are available." />
);
export const LiabilitySummaryWidgetView = ({ widget }: { widget: LiabilitySummaryWidget }) => (
  <CategorySummaryView {...widget.data} title={widget.title} reason={widget.reason} emptyLabel="No classified liabilities are available." />
);
export const EquitySnapshotWidgetView = ({ widget }: { widget: EquitySnapshotWidget }) => (
  <CategorySummaryView {...widget.data} title={widget.title} reason={widget.reason} emptyLabel="No classified equity is available." />
);

export function DebtOverviewWidgetView({ widget }: { widget: DebtOverviewWidget }) {
  return (
    <WidgetFrame title={widget.title} reason={widget.reason}>
      <Stack spacing={2}>
        {widget.data.groups.length === 0 ? <EmptyMessage>No active recorded debts are available.</EmptyMessage> : widget.data.groups.map((group) => (
          <Box key={`${group.sourceLabel}:${group.currency}`}>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 1 }}>
              <Chip size="small" label={`${group.sourceLabel} · ${group.currency}`} />
              <Chip size="small" label={formatCurrency(group.totalBalance, group.currency)} />
            </Stack>
            {group.debts.map((debt) => (
              <Stack key={debt.id} direction="row" justifyContent="space-between" spacing={2} sx={{ py: 0.75, borderBottom: "1px solid", borderColor: dashboardTokens.border }}>
                <Box>
                  <Typography variant="body2" fontWeight={700}>{debt.name}</Typography>
                  <Typography variant="caption" sx={{ color: dashboardTokens.textMuted }}>
                    {debt.lenderName ?? debt.debtType.replaceAll("_", " ")}
                    {debt.annualInterestRate === null ? "" : ` · ${debt.annualInterestRate}% p.a.`}
                    {debt.maturityDate ? ` · matures ${formatDate(debt.maturityDate)}` : ""}
                  </Typography>
                </Box>
                <Typography variant="body2" fontWeight={700}>{formatCurrency(debt.currentBalance, group.currency)}</Typography>
              </Stack>
            ))}
          </Box>
        ))}
        <Typography variant="caption" sx={{ color: dashboardTokens.textMuted }}>{widget.data.note}</Typography>
      </Stack>
    </WidgetFrame>
  );
}

export function DebtRepaymentTimelineWidgetView({ widget }: { widget: DebtRepaymentTimelineWidget }) {
  return (
    <WidgetFrame title={widget.title} reason={widget.reason}>
      <Stack spacing={2}>
        <Chip size="small" label={`${formatDate(widget.data.asOfDate)}–${formatDate(widget.data.throughDate)}`} sx={{ alignSelf: "flex-start" }} />
        {widget.data.groups.length === 0 ? <EmptyMessage>No stored scheduled repayments fall in this window.</EmptyMessage> : widget.data.groups.map((group) => (
          <Box key={`${group.sourceLabel}:${group.currency}`}>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 1 }}>
              <Chip size="small" label={`${group.sourceLabel} · ${group.currency}`} />
              <Chip size="small" label={formatCurrency(group.totalScheduled, group.currency)} />
            </Stack>
            {group.repayments.map((repayment) => (
              <Stack key={repayment.id} direction="row" justifyContent="space-between" spacing={2} sx={{ py: 0.75, borderBottom: "1px solid", borderColor: dashboardTokens.border }}>
                <Box>
                  <Typography variant="body2" fontWeight={700}>{repayment.debtName}</Typography>
                  <Typography variant="caption" sx={{ color: dashboardTokens.textMuted }}>
                    Due {formatDate(repayment.dueDate)} · Principal {formatCurrency(repayment.principalAmount, group.currency)} · Interest {formatCurrency(repayment.interestAmount, group.currency)}
                  </Typography>
                </Box>
                <Typography variant="body2" fontWeight={700}>{formatCurrency(repayment.totalAmount, group.currency)}</Typography>
              </Stack>
            ))}
          </Box>
        ))}
        <Typography variant="caption" sx={{ color: dashboardTokens.textMuted }}>{widget.data.note}</Typography>
      </Stack>
    </WidgetFrame>
  );
}
