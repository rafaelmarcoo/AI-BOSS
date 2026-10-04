"use client";

import { Box, Chip, Stack, Typography } from "@mui/material";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { dashboardCanvasTokens as dashboardTokens } from "@/app/theme";
import type { FinancialTrendData } from "@/lib/gen-ui/types";
import { WidgetFrame } from "../shared/WidgetFrame";
import {
  chartContextChipSx,
  formatAxisDate,
  formatAxisNumber,
  formatCurrency,
  formatPeriod,
  trendDirectionColor,
} from "../shared/formatting";

interface TrendChartWidgetProps {
  title: string;
  reason: string;
  data: FinancialTrendData;
  accent: string;
}

export function TrendChartWidget({ title, reason, data, accent }: TrendChartWidgetProps) {
  return (
    <WidgetFrame title={title} reason={reason}>
      <Stack spacing={1.5}>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Chip label={`Currency: ${data.currency ?? "Unavailable"}`} size="small" sx={chartContextChipSx} />
          <Chip label={`Period: ${formatPeriod(data.points)}`} size="small" sx={chartContextChipSx} />
          <Chip
            label={data.direction.replaceAll("_", " ")}
            size="small"
            sx={{ ...chartContextChipSx, color: trendDirectionColor(data.direction) }}
          />
        </Stack>
        <Box sx={{ width: "100%", height: 260, minWidth: 0 }}>
          <ResponsiveContainer
            width="100%"
            height="100%"
            minWidth={0}
            minHeight={180}
            initialDimension={{ width: 500, height: 260 }}
          >
            <LineChart data={data.points} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
              <CartesianGrid stroke="rgba(148,163,184,0.14)" strokeDasharray="3 3" />
              <XAxis dataKey="date" tickFormatter={formatAxisDate} stroke={dashboardTokens.textMuted} />
              <YAxis tickFormatter={(value) => formatAxisNumber(Number(value), false)} stroke={dashboardTokens.textMuted} />
              <Tooltip
                formatter={(value) => formatCurrency(Number(value), data.currency)}
                labelFormatter={(label) => formatAxisDate(String(label))}
              />
              <Line type="monotone" dataKey="value" name={data.label} stroke={accent} strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </Box>
        <Typography variant="caption" sx={{ color: dashboardTokens.textMuted }}>
          {data.note}
        </Typography>
      </Stack>
    </WidgetFrame>
  );
}
