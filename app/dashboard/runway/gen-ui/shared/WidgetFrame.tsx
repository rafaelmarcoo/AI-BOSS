"use client";

import type { ReactNode } from "react";
import { Box, Stack, Typography } from "@mui/material";
import { dashboardCanvasTokens as dashboardTokens } from "@/app/theme";

export function WidgetFrame({
  title,
  reason,
  children,
}: {
  title: string;
  reason: string;
  children: ReactNode;
}) {
  return (
    <Box
      sx={{
        p: { xs: 2, sm: 2.25 },
        color: dashboardTokens.text,
        minWidth: 0,
        height: "100%",
        bgcolor: "transparent",
      }}
    >
      <Stack spacing={1.5} sx={{ height: "100%" }}>
        <Typography sx={{ fontSize: 15, fontWeight: 600 }}>{title}</Typography>
        {children}
        <Box
          sx={{
            mt: "auto !important",
            pt: 1.25,
            borderTop: "1px solid",
            borderColor: dashboardTokens.border,
          }}
        >
          <Typography
            variant="caption"
            fontWeight={600}
            sx={{ color: "#2B6A9B", letterSpacing: 0 }}
          >
            Why AI-BOSS chose this widget
          </Typography>
          <Typography
            variant="body2"
            sx={{ color: dashboardTokens.textMuted, lineHeight: 1.6, mt: 0.5 }}
          >
            {reason}
          </Typography>
        </Box>
      </Stack>
    </Box>
  );
}
