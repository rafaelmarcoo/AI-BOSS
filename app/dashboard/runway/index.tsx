import { Box } from "@mui/material";
import { dashboardTokens } from "@/app/theme";
import { HistoricalMetricsChart } from "../BurnRateChart";
import type { GenUiPlan } from "@/lib/gen-ui/types";
import {
  formatFinancialCurrency,
  buildUnavailableWorkingCapitalAdjustedRunwayMetric,
  buildWorkingCapitalAdjustedRunwayMetric,
  getMetricNumber,
  isAvailableMetric,
  isSupportedFinancialCurrency,
  type CompleteFinancialMetricSet,
  type FinancialMetricKey,
  type FinancialMetricValue,
} from "@/lib/financial-data";
import { GenUiCanvas } from "./gen-ui/GenUiCanvas";
import { SelectableRunwayWorkspace } from "./selection-prompt";

type AskChatbotMode = "selection" | "prompt";

interface RunwaySectionProps {
  metrics: CompleteFinancialMetricSet;
  genUiPlan: GenUiPlan | null;
  onAskChatbot: (text: string, mode?: AskChatbotMode) => void;
}

function formatCurrencyMetric(metric: FinancialMetricValue) {
  if (!isAvailableMetric(metric)) return "unavailable";

  if (!isSupportedFinancialCurrency(metric.currency)) {
    return metric.currency
      ? `${metric.currency} is not supported for calculations`
      : "currency not provided";
  }

  return formatFinancialCurrency(metric.value, metric.currency);
}

function formatRunway(metric: FinancialMetricValue) {
  return isAvailableMetric(metric)
    ? `${metric.value.toFixed(2)} months`
    : metric.detail ?? "unavailable";
}

export function RunwaySection({
  metrics,
  genUiPlan,
  onAskChatbot,
}: RunwaySectionProps) {
  const missingMetricLabels = ([
    ["cash", "Cash"],
    ["accounts_receivable", "Accounts receivable"],
    ["accounts_payable", "Accounts payable"],
    ["monthly_revenue", "Monthly revenue"],
    ["monthly_expenses", "Monthly expenses"],
    ["burn_rate", "Burn rate"],
    ["runway_months", "Runway months"],
  ] satisfies Array<[FinancialMetricKey, string]>)
    .filter(([key]) => getMetricNumber(metrics, key) === null)
    .map(([, label]) => label);
  const workingCapitalAdjustedRunway =
    buildWorkingCapitalAdjustedRunwayMetric(metrics) ??
    buildUnavailableWorkingCapitalAdjustedRunwayMetric(metrics);
  const primaryRunwayLabel =
    isAvailableMetric(metrics.runway_months) &&
    !metrics.runway_months.provenance.sourceLabel.includes("cash runway calculated")
      ? "Reported runway"
      : "Primary cash runway";
  const baselineSummary = `${primaryRunwayLabel}: ${formatRunway(metrics.runway_months)} Working-capital-adjusted runway: ${formatRunway(workingCapitalAdjustedRunway)} Cash is ${formatCurrencyMetric(metrics.cash)} and monthly burn is ${formatCurrencyMetric(metrics.burn_rate)}.`;
  const historyRefreshKey = Object.values(metrics)
    .map((metric) => metric.updatedAt ?? "")
    .join("|");

  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, minHeight: "100%" }}>
      <Box
        sx={{
          display: "grid",
          gap: 3,
          width: "100%",
          maxWidth: dashboardTokens.contentMaxWidth,
          mx: "auto",
        }}
      >
        <SelectableRunwayWorkspace onAskChatbot={onAskChatbot}>
          <GenUiCanvas
            plan={genUiPlan}
            baselineSummary={baselineSummary}
            missingMetricLabels={missingMetricLabels}
            onAskChatbot={onAskChatbot}
          />
        </SelectableRunwayWorkspace>
        <HistoricalMetricsChart refreshKey={historyRefreshKey} />
      </Box>
    </Box>
  );
}
