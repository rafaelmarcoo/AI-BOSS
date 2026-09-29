"use client";

import type { ReactNode } from "react";
import { Box, Stack, Typography } from "@mui/material";
import { dashboardTokens } from "@/app/theme";

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
        py: { xs: 2.5, sm: 3 },
        color: "common.white",
        minWidth: 0,
        height: "100%",
      }}
    >
      <Stack spacing={1.75}>
        <Typography sx={{ fontSize: 16, fontWeight: 600 }}>{title}</Typography>
        {children}
        <Box
          sx={{
            pt: 1.25,
            borderTop: "1px solid",
            borderColor: dashboardTokens.border,
          }}
        >
          <Typography
            variant="caption"
            fontWeight={700}
            sx={{ color: "#bae6fd", letterSpacing: 0 }}
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

