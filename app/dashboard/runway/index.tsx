import { Box } from "@mui/material";
import type { GenUiPlan } from "@/lib/gen-ui/types";
import {
  getMetricNumber,
  type CompleteFinancialMetricSet,
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
  const baselineSummary = `Current runway is ${formatRunway(runway)}, with ${formatCurrency(cash)} cash and ${formatCurrency(burn)} monthly burn.`;

  return (
    <Box sx={{ p: { xs: 3, sm: 4 }, minHeight: "100%" }}>
      <SelectableRunwayWorkspace onAskChatbot={onAskChatbot}>
        <GenUiCanvas
          plan={genUiPlan}
          baselineSummary={baselineSummary}
          onAskChatbot={onAskChatbot}
        />
      </SelectableRunwayWorkspace>
    </Box>
  );
}
