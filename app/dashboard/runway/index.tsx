import { Box } from "@mui/material";
import { dashboardTokens } from "@/app/theme";
import { HistoricalMetricsChart } from "../BurnRateChart";
import type { GenUiPlan } from "@/lib/gen-ui/types";
import {
  formatFinancialCurrency,
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

function formatRunway(value: number | null) {
  return value === null ? "unavailable" : `${value.toFixed(1)} months`;
}

export function RunwaySection({
  metrics,
  genUiPlan,
  onAskChatbot,
}: RunwaySectionProps) {
  const runway = getMetricNumber(metrics, "runway_months");
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
  const baselineSummary = `Current runway is ${formatRunway(runway)}, with cash of ${formatCurrencyMetric(metrics.cash)} and monthly burn of ${formatCurrencyMetric(metrics.burn_rate)}.`;
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
