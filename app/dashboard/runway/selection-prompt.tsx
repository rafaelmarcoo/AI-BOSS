"use client";

import { useRef, useState } from "react";
import {
  Box,
  Button,
  Chip,
  Paper,
  Popover,
  Stack,
  Typography,
} from "@mui/material";
import ChatBubbleRoundedIcon from "@mui/icons-material/ChatBubbleRounded";
import HighlightAltRoundedIcon from "@mui/icons-material/HighlightAltRounded";
import { dashboardTokens } from "@/app/theme";

interface RunwaySelectionPromptProps {
  summaryText: string;
  onAskChatbot: (selectionText: string) => void;
}

interface AnchorPosition {
  top: number;
  left: number;
}

export function RunwaySelectionPrompt({
  summaryText,
  onAskChatbot,
}: RunwaySelectionPromptProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [selectionText, setSelectionText] = useState("");
  const [anchorPosition, setAnchorPosition] = useState<AnchorPosition | null>(
    null,
  );

  const clearSelection = () => {
    setSelectionText("");
    setAnchorPosition(null);
    window.getSelection()?.removeAllRanges();
  };

  const handleMouseUp = () => {
    const selection = window.getSelection();

    if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
      return;
    }

    const text = selection.toString().trim().replace(/\s+/g, " ");

    if (!text) {
      return;
    }

    const range = selection.getRangeAt(0);
    const container = containerRef.current;

    if (!container || !container.contains(range.commonAncestorContainer)) {
      return;
    }

    const rect = range.getBoundingClientRect();

    setSelectionText(text.length > 140 ? `${text.slice(0, 137)}...` : text);
    setAnchorPosition({
      top: rect.bottom + 12,
      left: rect.left + rect.width / 2,
    });
  };

  const handleAskChatbot = () => {
    onAskChatbot(selectionText);
    clearSelection();
  };

  return (
    <Box
      ref={containerRef}
      onMouseUp={handleMouseUp}
      sx={{ position: "relative" }}
    >
      <Paper
        elevation={0}
        sx={{
          p: 2.5,
          borderRadius: 1,
          bgcolor: "rgba(37, 99, 235, 0.08)",
          border: "1px solid",
          borderColor: "rgba(96, 165, 250, 0.25)",
          color: "common.white",
          overflow: "hidden",
        }}
      >
        <Stack spacing={1.5}>
          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            flexWrap="wrap"
          >
            <Chip
              icon={<HighlightAltRoundedIcon />}
              label="AI-BOSS insight"
              size="small"
              sx={{
                color: "#bfdbfe",
                bgcolor: "rgba(59, 130, 246, 0.12)",
                borderColor: "rgba(96, 165, 250, 0.25)",
              }}
              variant="outlined"
            />
            <Typography
              variant="caption"
              sx={{ color: dashboardTokens.textMuted }}
            >
              Runway summary
            </Typography>
          </Stack>

          <Typography
            variant="body2"
            sx={{
              color: "common.white",
              lineHeight: 1.8,
              userSelect: "text",
              cursor: "text",
            }}
          >
            {summaryText}
          </Typography>
        </Stack>
      </Paper>

      <Popover
        open={Boolean(selectionText && anchorPosition)}
        anchorReference="anchorPosition"
        anchorPosition={anchorPosition ?? undefined}
        onClose={clearSelection}
        transformOrigin={{ vertical: "top", horizontal: "center" }}
        disableAutoFocus
        disableEnforceFocus
        disableRestoreFocus
        PaperProps={{
          sx: {
            width: { xs: 300, sm: 360 },
            mt: 0.5,
            borderRadius: 2,
            overflow: "hidden",
          },
        }}
      >
        <Paper
          elevation={0}
          sx={{
            p: 2,
            bgcolor: dashboardTokens.sidebarV2,
            color: "common.white",
            border: "1px solid",
            borderColor: dashboardTokens.border,
          }}
        >
          <Stack spacing={1.5}>
            <Stack spacing={0.5}>
              <Typography variant="overline" sx={{ color: dashboardTokens.textMuted }}>
                Ask AI-BOSS
              </Typography>
              <Typography
                variant="body2"
                sx={{ color: "common.white", lineHeight: 1.6 }}
              >
                {selectionText}
              </Typography>
            </Stack>

            <Stack direction="row" spacing={1} justifyContent="flex-end">
              <Button
                size="small"
                onClick={clearSelection}
                sx={{ color: dashboardTokens.textMuted }}
              >
                Cancel
              </Button>
              <Button
                size="small"
                variant="contained"
                startIcon={<ChatBubbleRoundedIcon fontSize="small" />}
                onClick={handleAskChatbot}
                sx={{ color: "common.white" }}
              >
                Ask chatbot
              </Button>
            </Stack>
          </Stack>
        </Paper>
      </Popover>
    </Box>
  );
}
