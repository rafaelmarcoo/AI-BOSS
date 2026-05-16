import { Box, Button, Paper, Stack, Typography } from "@mui/material";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import { dashboardTokens } from "@/app/theme";
import { DataSourcesPanel } from "@/components/data-sources-panel";
import {
  getMetricNumber,
  isAvailableMetric,
  type CompleteFinancialMetricSet,
  type FinancialMetricKey,
  type FinancialMetricValue,
} from "@/lib/financial-data";
import { MetricCard } from "../MetricCard";
import { BurnRateChart } from "../BurnRateChart";
import { RecentActivity } from "../RecentActivity";
import { RunwaySelectionPrompt } from "./selection-prompt";

interface RunwaySectionProps {
  metrics: CompleteFinancialMetricSet;
  onAskChatbot: (selectionText: string) => void;
}

// Helper to format currency
function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("en-NZ", {
    style: "currency",
    currency: "NZD",
    maximumFractionDigits: 0,
  }).format(value);
}

// Helper to format numbers with one decimal
function formatNumber(value: number | null | undefined, decimals = 1): string {
  if (value === null || value === undefined) return "—";
  return value.toFixed(decimals);
}

function formatSource(metric: FinancialMetricValue) {
  if (!isAvailableMetric(metric)) {
    return "Unavailable";
  }

  if (metric.provenance.sourceType === "document") {
    return `CSV: ${metric.provenance.sourceLabel}`;
  }

  if (metric.provenance.sourceType === "demo") {
    return `Demo: ${metric.provenance.sourceLabel}`;
  }

  return metric.provenance.sourceLabel;
}

function getSourceTone(metric: FinancialMetricValue) {
  return isAvailableMetric(metric) ? "available" : "unavailable";
}

function formatMetricValue(
  metrics: CompleteFinancialMetricSet,
  key: FinancialMetricKey,
  formatter: (value: number | null | undefined) => string,
) {
  return formatter(getMetricNumber(metrics, key));
}

export function RunwaySection({ metrics, onAskChatbot }: RunwaySectionProps) {
  const monthlyRevenue = getMetricNumber(metrics, "monthly_revenue");
  const monthlyExpenses = getMetricNumber(metrics, "monthly_expenses");
  const cashBalance = getMetricNumber(metrics, "cash");
  const runwayMonths = getMetricNumber(metrics, "runway_months");
  const burnRate = getMetricNumber(metrics, "burn_rate");
  const netLoss =
    monthlyRevenue !== null && monthlyExpenses !== null
      ? monthlyExpenses - monthlyRevenue
      : null;
  const netLossSource =
    monthlyRevenue !== null && monthlyExpenses !== null
      ? "Derived from revenue/expenses"
      : "Unavailable";

  return (
    <Box sx={{ p: { xs: 3, sm: 4 }, flex: 1 }}>
      <Stack spacing={3}>
        <RunwaySelectionPrompt
          onAskChatbot={onAskChatbot}
          summaryText={`Runway is ${formatNumber(runwayMonths)} months with cash at ${formatCurrency(cashBalance)} and monthly burn at ${formatCurrency(burnRate)}.`}
        />

        {/* Runway Status Header Card */}
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
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
          >
            <Stack direction="row" alignItems="center" spacing={2}>
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: 2,
                  bgcolor: dashboardTokens.surface,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <TrendingUpIcon sx={{ color: "common.white", fontSize: 20 }} />
              </Box>
              <Stack spacing={0.5}>
                <Typography variant="h6" fontWeight={700}>
                  Runway Status
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ color: dashboardTokens.textMuted }}
                >
                  Source-aware metrics from connected systems and uploaded
                  financial documents.
                </Typography>
              </Stack>
            </Stack>
            <Button
              size="small"
              variant="outlined"
              sx={{
                borderRadius: 999,
                color: "common.white",
                borderColor: dashboardTokens.borderMuted,
                fontSize: "0.75rem",
              }}
            >
              Live
            </Button>
          </Stack>
        </Paper>

        <DataSourcesPanel />

        {/* Metric Cards */}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr",
              sm: "repeat(2, 1fr)",
              xl: "repeat(4, 1fr)",
            },
            gap: 2,
          }}
        >
          <MetricCard
            label="CASH BALANCE"
            value={formatMetricValue(metrics, "cash", formatCurrency)}
            color="#00e5a0"
            sourceLabel={formatSource(metrics.cash)}
            sourceTone={getSourceTone(metrics.cash)}
          />
          <MetricCard
            label="ACCOUNTS RECEIVABLE"
            value={formatMetricValue(
              metrics,
              "accounts_receivable",
              formatCurrency,
            )}
            color="#38bdf8"
            sourceLabel={formatSource(metrics.accounts_receivable)}
            sourceTone={getSourceTone(metrics.accounts_receivable)}
          />
          <MetricCard
            label="ACCOUNTS PAYABLE"
            value={formatMetricValue(
              metrics,
              "accounts_payable",
              formatCurrency,
            )}
            color="#f97316"
            sourceLabel={formatSource(metrics.accounts_payable)}
            sourceTone={getSourceTone(metrics.accounts_payable)}
          />
          <MetricCard
            label="RUNWAY"
            value={formatMetricValue(metrics, "runway_months", formatNumber)}
            unit="months"
            color="#4da6ff"
            sourceLabel={formatSource(metrics.runway_months)}
            sourceTone={getSourceTone(metrics.runway_months)}
          />
          <MetricCard
            label="MONTHLY BURN"
            value={formatMetricValue(metrics, "burn_rate", formatCurrency)}
            color="#ff4d6d"
            sourceLabel={formatSource(metrics.burn_rate)}
            sourceTone={getSourceTone(metrics.burn_rate)}
          />
          <MetricCard
            label="MONTHLY REVENUE"
            value={formatMetricValue(
              metrics,
              "monthly_revenue",
              formatCurrency,
            )}
            color="#22c55e"
            sourceLabel={formatSource(metrics.monthly_revenue)}
            sourceTone={getSourceTone(metrics.monthly_revenue)}
          />
          <MetricCard
            label="MONTHLY EXPENSES"
            value={formatMetricValue(
              metrics,
              "monthly_expenses",
              formatCurrency,
            )}
            color="#f43f5e"
            sourceLabel={formatSource(metrics.monthly_expenses)}
            sourceTone={getSourceTone(metrics.monthly_expenses)}
          />
          <MetricCard
            label="NET LOSS"
            value={formatCurrency(netLoss)}
            color="#ffa500"
            sourceLabel={netLossSource}
            sourceTone={netLoss === null ? "unavailable" : "derived"}
          />
        </Box>

        {/* Financial Overview Chart */}
        <BurnRateChart />

        {/* Recent Activity */}
        <RecentActivity />
      </Stack>
    </Box>
  );
}
