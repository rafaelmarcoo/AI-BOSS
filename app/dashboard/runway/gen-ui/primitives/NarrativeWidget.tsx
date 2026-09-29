"use client";

import { Box, Stack, Typography } from "@mui/material";
import { dashboardTokens } from "@/app/theme";
import type { AiFinancialBriefWidget } from "@/lib/gen-ui/types";
import { WidgetFrame } from "../shared/WidgetFrame";

const toneColor = {
  positive: dashboardTokens.positive,
  warning: dashboardTokens.warning,
  neutral: "#38bdf8",
} as const;

export function NarrativeWidget({ widget }: { widget: AiFinancialBriefWidget }) {
  return (
    <WidgetFrame title={widget.title} reason={widget.reason}>
      <Stack spacing={1.5}>
        <Typography variant="body2" sx={{ color: dashboardTokens.textSoft, lineHeight: 1.65 }}>
          {widget.data.summary}
        </Typography>
        <Stack spacing={1}>
          {widget.data.facts.map((fact) => (
            <Box
              key={`${fact.label}:${fact.value}`}
              sx={{ p: 1.25, borderLeft: "3px solid", borderColor: toneColor[fact.tone], bgcolor: "rgba(255,255,255,0.025)" }}
            >
              <Stack direction="row" justifyContent="space-between" spacing={1}>
                <Typography variant="body2" fontWeight={700}>{fact.label}</Typography>
                <Typography variant="body2" fontWeight={700} sx={{ color: toneColor[fact.tone] }}>{fact.value}</Typography>
              </Stack>
              <Typography variant="caption" display="block" sx={{ color: dashboardTokens.textMuted, mt: 0.25 }}>
                {fact.detail}
              </Typography>
              <Typography variant="caption" sx={{ color: dashboardTokens.textMuted }}>
                Source: {fact.sourceLabel}
              </Typography>
            </Box>
          ))}
        </Stack>
      </Stack>
    </WidgetFrame>
  );
}
