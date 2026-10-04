"use client";

import { Box, Chip, Stack, Typography } from "@mui/material";
import { dashboardCanvasTokens as dashboardTokens } from "@/app/theme";
import type { FinancialKpiData } from "@/lib/gen-ui/types";
import { WidgetFrame } from "../shared/WidgetFrame";
import { formatCurrency, formatDate } from "../shared/formatting";

interface KpiWidgetProps {
  title: string;
  reason: string;
  data: FinancialKpiData;
  accent: string;
}

export function KpiWidget({ title, reason, data, accent }: KpiWidgetProps) {
  const period = data.periodStart && data.periodEnd
    ? data.periodStart === data.periodEnd
      ? formatDate(data.periodEnd)
      : `${formatDate(data.periodStart)}–${formatDate(data.periodEnd)}`
    : data.reportingDate
      ? formatDate(data.reportingDate)
      : "Reporting date unavailable";

  return (
    <WidgetFrame title={title} reason={reason}>
      <Stack spacing={1.5}>
        <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="center">
          <Typography variant="body2" sx={{ color: dashboardTokens.textMuted }}>
            {data.label}
          </Typography>
          <Chip
            label={data.sourceLabel}
            size="small"
            sx={{ color: dashboardTokens.textSoft, borderColor: dashboardTokens.border }}
            variant="outlined"
          />
        </Stack>
        <Typography sx={{ fontSize: { xs: 28, sm: 34 }, fontWeight: 700, color: accent }}>
          {formatCurrency(data.value, data.currency)}
        </Typography>
        <Box>
          <Typography variant="caption" display="block" sx={{ color: dashboardTokens.textMuted }}>
            Reporting period: {period}
          </Typography>
          <Typography variant="caption" sx={{ color: dashboardTokens.textMuted }}>
            {data.confidence === null
              ? "Verification confidence unavailable"
              : `${Math.round(data.confidence * 100)}% verification confidence`}
          </Typography>
        </Box>
      </Stack>
    </WidgetFrame>
  );
}
