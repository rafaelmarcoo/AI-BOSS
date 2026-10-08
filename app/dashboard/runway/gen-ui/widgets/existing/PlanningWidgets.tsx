"use client";

import { Box, Button, Chip, Stack, Typography } from "@mui/material";
import ChatBubbleRoundedIcon from "@mui/icons-material/ChatBubbleRounded";
import { dashboardCanvasTokens as dashboardTokens } from "@/app/theme";
import { formatRunway } from "@/lib/calculations/runway-display";
import type {
  HighlightExplainerWidget as HighlightExplainerWidgetModel,
  MissingDataPanelWidget as MissingDataPanelWidgetModel,
  PlanningChecklistWidget as PlanningChecklistWidgetModel,
  RiskThresholdTimelineWidget as RiskThresholdTimelineWidgetModel,
} from "@/lib/gen-ui/types";
import { WidgetFrame } from "../../shared/WidgetFrame";
import type { AskChatbotMode } from "../../types";

function statusColor(status: RiskThresholdTimelineWidgetModel["data"]["status"]) {
  if (status === "urgent") return dashboardTokens.negative;
  if (status === "caution") return dashboardTokens.warning;
  if (status === "healthy") return dashboardTokens.positive;
  return dashboardTokens.textMuted;
}

export function PlanningChecklistWidgetView({
  widget,
}: {
  widget: PlanningChecklistWidgetModel;
}) {
  const toneColors = {
    urgent: dashboardTokens.negative,
    watch: dashboardTokens.warning,
    steady: dashboardTokens.positive,
  };

  return (
    <WidgetFrame title={widget.title} reason={widget.reason}>
      <Stack spacing={1}>
        {widget.data.items.map((item) => (
          <Stack
            key={item.label}
            direction="row"
            spacing={1.25}
            sx={{
              p: 1.25,
              borderRadius: 1,
              bgcolor: dashboardTokens.surfaceAlt,
              border: "1px solid",
              borderColor: dashboardTokens.border,
            }}
          >
            <Box
              sx={{
                width: 9,
                height: 9,
                borderRadius: "50%",
                mt: 0.6,
                bgcolor: toneColors[item.tone],
                flex: "0 0 auto",
              }}
            />
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body2" fontWeight={700}>
                {item.label}
              </Typography>
              <Typography variant="caption" sx={{ color: dashboardTokens.textMuted }}>
                {item.detail}
              </Typography>
            </Box>
          </Stack>
        ))}
      </Stack>
    </WidgetFrame>
  );
}

export function RiskThresholdTimelineWidgetView({
  widget,
}: {
  widget: RiskThresholdTimelineWidgetModel;
}) {
  const color = statusColor(widget.data.status);
  const runwayPercent =
    widget.data.currentRunway === null
      ? 0
      : Math.min(100, (widget.data.currentRunway / 12) * 100);
  const adjustedPercent =
    widget.data.workingCapitalAdjustedRunway === null ||
    widget.data.workingCapitalAdjustedRunway === undefined
      ? 0
      : Math.min(100, (widget.data.workingCapitalAdjustedRunway / 12) * 100);

  return (
    <WidgetFrame title={widget.title} reason={widget.reason}>
      <Stack spacing={1.25}>
        <Stack direction="row" justifyContent="space-between" spacing={1}>
          <Typography variant="body2" sx={{ color: dashboardTokens.textMuted }}>
            Cash runway
          </Typography>
          <Typography variant="body2" fontWeight={700} sx={{ color }}>
            {widget.data.currentRunway === null
              ? "Unavailable"
              : formatRunway(widget.data.currentRunway)}
          </Typography>
        </Stack>
        <Box
          sx={{
            height: 10,
            borderRadius: 999,
            bgcolor: dashboardTokens.surfaceAlt,
            overflow: "hidden",
          }}
        >
          <Box
            sx={{
              width: `${Math.max(0, runwayPercent)}%`,
              height: "100%",
              bgcolor: color,
              borderRadius: 999,
            }}
          />
        </Box>
        <Stack direction="row" justifyContent="space-between" spacing={1}>
          <Typography variant="body2" sx={{ color: dashboardTokens.textMuted }}>
            Working-capital-adjusted runway
          </Typography>
          <Typography variant="body2" fontWeight={700} sx={{ color: dashboardTokens.adjusted }}>
            {widget.data.workingCapitalAdjustedRunway === null ||
            widget.data.workingCapitalAdjustedRunway === undefined
              ? "Unavailable"
              : formatRunway(widget.data.workingCapitalAdjustedRunway)}
          </Typography>
        </Stack>
        <Box
          sx={{
            height: 10,
            borderRadius: 999,
            bgcolor: dashboardTokens.surfaceAlt,
            overflow: "hidden",
          }}
        >
          <Box
            sx={{
              width: `${Math.max(0, adjustedPercent)}%`,
              height: "100%",
              bgcolor: dashboardTokens.adjusted,
              borderRadius: 999,
            }}
          />
        </Box>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
            gap: 1,
          }}
        >
          <Box sx={{ p: 1.25, borderRadius: 1, bgcolor: "rgba(251,191,36,0.08)" }}>
            <Typography variant="caption" sx={{ color: dashboardTokens.warning }}>
              Caution
            </Typography>
            <Typography variant="body2" fontWeight={700}>
              {widget.data.monthsUntilCaution === null
                ? "Not trending there"
                : formatRunway(widget.data.monthsUntilCaution)}
            </Typography>
          </Box>
          <Box sx={{ p: 1.25, borderRadius: 1, bgcolor: "rgba(251,113,133,0.08)" }}>
            <Typography variant="caption" sx={{ color: dashboardTokens.negative }}>
              Urgent
            </Typography>
            <Typography variant="body2" fontWeight={700}>
              {widget.data.monthsUntilUrgent === null
                ? "Not trending there"
                : formatRunway(widget.data.monthsUntilUrgent)}
            </Typography>
          </Box>
        </Box>
        <Typography variant="body2" sx={{ color: dashboardTokens.textMuted }}>
          {widget.data.message}
        </Typography>
      </Stack>
    </WidgetFrame>
  );
}

export function MissingDataPanelWidgetView({
  widget,
}: {
  widget: MissingDataPanelWidgetModel;
}) {
  return (
    <WidgetFrame title={widget.title} reason={widget.reason}>
      <Stack spacing={1}>
        <Typography variant="body2" sx={{ color: dashboardTokens.textMuted }}>
          {widget.data.message}
        </Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {widget.data.missingMetrics.map((metric) => (
            <Chip
              key={metric}
              label={metric}
              size="small"
              sx={{
                color: dashboardTokens.negative,
                bgcolor: "rgba(244, 63, 94, 0.12)",
              }}
            />
          ))}
        </Stack>
      </Stack>
    </WidgetFrame>
  );
}

export function HighlightExplainerWidgetView({
  widget,
  onAskChatbot,
}: {
  widget: HighlightExplainerWidgetModel;
  onAskChatbot: (text: string, mode?: AskChatbotMode) => void;
}) {
  return (
    <WidgetFrame title={widget.title} reason={widget.reason}>
      <Stack spacing={1.25}>
        <Box
          sx={{
            p: 1.5,
            borderRadius: 1,
            bgcolor: "rgba(59, 130, 246, 0.10)",
            border: "1px solid",
            borderColor: "rgba(96, 165, 250, 0.22)",
          }}
        >
          <Typography variant="body2" sx={{ color: dashboardTokens.text, lineHeight: 1.6 }}>
            {widget.data.selectedText}
          </Typography>
        </Box>
        <Button
          size="small"
          variant="outlined"
          startIcon={<ChatBubbleRoundedIcon fontSize="small" />}
          onClick={() => onAskChatbot(widget.data.prompt, "prompt")}
          sx={{
            alignSelf: "flex-start",
            borderRadius: 999,
            color: dashboardTokens.text,
            borderColor: dashboardTokens.borderMuted,
            textTransform: "none",
          }}
        >
          Ask follow-up
        </Button>
      </Stack>
    </WidgetFrame>
  );
}
