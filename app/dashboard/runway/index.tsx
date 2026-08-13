import { Box } from "@mui/material";
import { dashboardTokens } from "@/app/theme";
import { HistoricalMetricsChart } from "../BurnRateChart";
import type { GenUiPlan } from "@/lib/gen-ui/types";
import {
  getMetricNumber,
  type CompleteFinancialMetricSet,
  type FinancialMetricKey,
} from "@/lib/financial-data";
import { GenUiCanvas } from "./gen-ui/GenUiCanvas";
import { SelectableRunwayWorkspace } from "./selection-prompt";

type AskChatbotMode = "selection" | "prompt";

interface RunwaySectionProps {
  metrics: CompleteFinancialMetricSet;
  genUiPlan: GenUiPlan | null;
  onAskChatbot: (text: string, mode?: AskChatbotMode) => void;
}

function formatCurrency(value: number | null) {
  if (value === null) return "unavailable";

  return new Intl.NumberFormat("en-NZ", {
    style: "currency",
    currency: "NZD",
    maximumFractionDigits: 0,
  }).format(value);
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
  const cash = getMetricNumber(metrics, "cash");
  const burn = getMetricNumber(metrics, "burn_rate");
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
  const baselineSummary = `Current runway is ${formatRunway(runway)}, with ${formatCurrency(cash)} cash and ${formatCurrency(burn)} monthly burn.`;
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
