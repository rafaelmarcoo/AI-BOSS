"use client";

import { Box, Chip, LinearProgress, Stack, Typography } from "@mui/material";
import { dashboardTokens } from "@/app/theme";
import type {
  BillsDueWidget,
  ExpectedPaymentsWidget,
  InvoiceAgeingWidget,
  InvoiceBalanceGroupData,
  OverdueInvoicesWidget,
} from "@/lib/gen-ui/types";
import { WidgetFrame } from "../../shared/WidgetFrame";
import { formatCurrency, formatDate } from "../../shared/formatting";

function EmptyMessage({ children }: { children: string }) {
  return <Typography variant="body2" sx={{ color: dashboardTokens.textMuted }}>{children}</Typography>;
}

function InvoiceGroups({ groups, showOverdue }: { groups: InvoiceBalanceGroupData[]; showOverdue: boolean }) {
  if (groups.length === 0) return <EmptyMessage>No matching open balances.</EmptyMessage>;
  return (
    <Stack spacing={2}>
      {groups.map((group) => (
        <Box key={`${group.sourceLabel}:${group.currency}`}>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 1 }}>
            <Chip size="small" label={`${group.sourceLabel} · ${group.currency}`} />
            <Chip size="small" label={`${group.count} open`} />
            <Chip size="small" label={formatCurrency(group.totalOutstanding, group.currency)} />
          </Stack>
          <Stack spacing={0.75}>
            {group.items.map((invoice) => (
              <Stack
                key={invoice.id}
                direction="row"
                justifyContent="space-between"
                alignItems="flex-start"
                spacing={2}
                sx={{ py: 0.75, borderBottom: "1px solid", borderColor: dashboardTokens.border }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2" fontWeight={700} noWrap>
                    {invoice.counterpartyName ?? invoice.invoiceNumber ?? "Invoice"}
                  </Typography>
                  <Typography variant="caption" sx={{ color: dashboardTokens.textMuted }}>
                    {invoice.invoiceNumber ? `${invoice.invoiceNumber} · ` : ""}Due {formatDate(invoice.dueDate)}
                    {showOverdue && invoice.daysOverdue !== null ? ` · ${invoice.daysOverdue} days overdue` : ""}
                  </Typography>
                </Box>
                <Typography variant="body2" fontWeight={700} sx={{ flexShrink: 0 }}>
                  {formatCurrency(invoice.outstandingAmount, group.currency)}
                </Typography>
              </Stack>
            ))}
          </Stack>
          {group.count > group.items.length ? (
            <Typography variant="caption" sx={{ color: dashboardTokens.textMuted }}>
              Showing {group.items.length} of {group.count} records.
            </Typography>
          ) : null}
        </Box>
      ))}
    </Stack>
  );
}

export function OverdueInvoicesWidgetView({ widget }: { widget: OverdueInvoicesWidget }) {
  return (
    <WidgetFrame title={widget.title} reason={widget.reason}>
      <Stack spacing={1.5}>
        <Chip size="small" label={`As of ${formatDate(widget.data.asOfDate)}`} sx={{ alignSelf: "flex-start" }} />
        <InvoiceGroups groups={widget.data.groups} showOverdue />
        <Typography variant="caption" sx={{ color: dashboardTokens.textMuted }}>{widget.data.note}</Typography>
      </Stack>
    </WidgetFrame>
  );
}

export function InvoiceAgeingWidgetView({ widget }: { widget: InvoiceAgeingWidget }) {
  return (
    <WidgetFrame title={widget.title} reason={widget.reason}>
      <Stack spacing={1.75}>
        <Chip size="small" label={`As of ${formatDate(widget.data.asOfDate)}`} sx={{ alignSelf: "flex-start" }} />
        {widget.data.groups.length === 0 ? <EmptyMessage>No overdue balances to age.</EmptyMessage> : widget.data.groups.map((group) => (
          <Box key={`${group.sourceLabel}:${group.currency}`}>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 1 }}>
              <Chip size="small" label={`${group.sourceLabel} · ${group.currency}`} />
              <Chip size="small" label={formatCurrency(group.totalOutstanding, group.currency)} />
            </Stack>
            <Stack spacing={1.1}>
              {group.buckets.map((bucket) => (
                <Box key={bucket.key}>
                  <Stack direction="row" justifyContent="space-between" spacing={1}>
                    <Typography variant="body2">{bucket.label} · {bucket.count}</Typography>
                    <Typography variant="body2" fontWeight={700}>{formatCurrency(bucket.amount, group.currency)}</Typography>
                  </Stack>
                  <LinearProgress variant="determinate" value={bucket.percentage} sx={{ mt: 0.5, height: 7, borderRadius: 4 }} />
                </Box>
              ))}
            </Stack>
          </Box>
        ))}
        <Typography variant="caption" sx={{ color: dashboardTokens.textMuted }}>{widget.data.note}</Typography>
      </Stack>
    </WidgetFrame>
  );
}

function UpcomingInvoiceView({
  title,
  reason,
  data,
  method,
}: {
  title: string;
  reason: string;
  data: BillsDueWidget["data"] | ExpectedPaymentsWidget["data"];
  method?: string;
}) {
  return (
    <WidgetFrame title={title} reason={reason}>
      <Stack spacing={1.5}>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Chip size="small" label={`${data.horizonDays}-day window`} />
          <Chip size="small" label={`${formatDate(data.asOfDate)}–${formatDate(data.throughDate)}`} />
        </Stack>
        <InvoiceGroups groups={data.groups} showOverdue={false} />
        {method ? <Typography variant="caption" sx={{ color: dashboardTokens.textMuted }}>Method: {method}.</Typography> : null}
        <Typography variant="caption" sx={{ color: dashboardTokens.textMuted }}>{data.note}</Typography>
      </Stack>
    </WidgetFrame>
  );
}

export const ExpectedPaymentsWidgetView = ({ widget }: { widget: ExpectedPaymentsWidget }) => (
  <UpcomingInvoiceView title={widget.title} reason={widget.reason} data={widget.data} method={widget.data.method} />
);

export const BillsDueWidgetView = ({ widget }: { widget: BillsDueWidget }) => (
  <UpcomingInvoiceView title={widget.title} reason={widget.reason} data={widget.data} />
);
