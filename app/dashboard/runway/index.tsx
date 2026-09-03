import { Box } from "@mui/material";
import { dashboardTokens } from "@/app/theme";
import type { GenUiPlan } from "@/lib/gen-ui/types";
import { GenUiCanvas } from "./gen-ui/GenUiCanvas";
import { SelectableRunwayWorkspace } from "./selection-prompt";

type AskChatbotMode = "selection" | "prompt";

interface RunwaySectionProps {
  genUiPlan: GenUiPlan | null;
  onAskChatbot: (text: string, mode?: AskChatbotMode) => void;
}

export function RunwaySection({
  genUiPlan,
  onAskChatbot,
}: RunwaySectionProps) {
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
            onAskChatbot={onAskChatbot}
          />
        </SelectableRunwayWorkspace>
      </Box>
    </Box>
  );
}
