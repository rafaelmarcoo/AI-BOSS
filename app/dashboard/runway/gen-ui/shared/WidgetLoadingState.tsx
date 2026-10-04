"use client";

import { Skeleton, Stack, Typography } from "@mui/material";
import { dashboardCanvasTokens as dashboardTokens } from "@/app/theme";

export function WidgetLoadingState({ message = "Loading widget data…" }: { message?: string }) {
  return (
    <Stack spacing={1.25} role="status" aria-label={message}>
      <Typography variant="body2" sx={{ color: dashboardTokens.textMuted }}>
        {message}
      </Typography>
      <Skeleton variant="rounded" height={72} sx={{ bgcolor: dashboardTokens.surfaceAlt }} />
    </Stack>
  );
}
