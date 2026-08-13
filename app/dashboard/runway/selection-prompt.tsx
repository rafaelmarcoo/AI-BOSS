"use client";

import type { ReactNode } from "react";
import { useRef, useState } from "react";
import {
  Box,
  Button,
  Paper,
  Popover,
  Stack,
  Typography,
} from "@mui/material";
import ChatBubbleRoundedIcon from "@mui/icons-material/ChatBubbleRounded";
import { dashboardTokens } from "@/app/theme";

interface SelectableRunwayWorkspaceProps {
  children: ReactNode;
  onAskChatbot: (selectionText: string) => void;
}

interface AnchorPosition {
  top: number;
  left: number;
}

export function SelectableRunwayWorkspace({
  children,
  onAskChatbot,
}: SelectableRunwayWorkspaceProps) {
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
      {children}

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
            borderRadius: `${dashboardTokens.radiusMd}px`,
            overflow: "hidden",
          },
        }}
      >
        <Paper
          elevation={0}
          sx={{
            p: 1.5,
            bgcolor: dashboardTokens.surface,
            color: dashboardTokens.text,
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
                sx={{ color: dashboardTokens.text, lineHeight: 1.6 }}
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
                sx={{ color: dashboardTokens.text, borderRadius: `${dashboardTokens.radiusSm}px` }}
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
