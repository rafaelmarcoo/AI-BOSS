"use client";

import { useState } from "react";
import {
  Box,
  Button,
  ButtonGroup,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { dashboardTokens } from "@/app/theme";

// Mock data for different time periods
const MOCK_DATA = {
  "1M": [
    { date: "Week 1", burn: 18000 },
    { date: "Week 2", burn: 19500 },
    { date: "Week 3", burn: 20000 },
    { date: "Week 4", burn: 21000 },
  ],
  "3M": [
    { date: "Mar", burn: 18000 },
    { date: "Mar", burn: 19000 },
    { date: "Mar", burn: 19500 },
    { date: "Apr", burn: 20000 },
    { date: "Apr", burn: 20500 },
    { date: "Apr", burn: 21000 },
    { date: "May", burn: 21500 },
    { date: "May", burn: 22000 },
    { date: "May", burn: 22500 },
    { date: "May", burn: 23000 },
    { date: "Jun", burn: 23500 },
    { date: "Jun", burn: 24000 },
  ],
  "6M": [
    { date: "Jan", burn: 15000 },
    { date: "Feb", burn: 16500 },
    { date: "Mar", burn: 18000 },
    { date: "Apr", burn: 20000 },
    { date: "May", burn: 22000 },
    { date: "Jun", burn: 24000 },
  ],
  YTD: [
    { date: "Jan", burn: 15000 },
    { date: "Feb", burn: 16500 },
    { date: "Mar", burn: 18000 },
    { date: "Apr", burn: 20000 },
    { date: "May", burn: 22000 },
    { date: "Jun", burn: 24000 },
    { date: "Jul", burn: 25000 },
    { date: "Aug", burn: 24500 },
    { date: "Sep", burn: 23500 },
    { date: "Oct", burn: 22000 },
    { date: "Nov", burn: 21000 },
    { date: "Dec", burn: 20500 },
  ],
};

export function BurnRateChart() {
  const [period, setPeriod] = useState<"1M" | "3M" | "6M" | "YTD">("3M");
  const data = MOCK_DATA[period];

  return (
    <Paper
      elevation={0}
      sx={{
        p: 3,
        borderRadius: 1,
        bgcolor: dashboardTokens.runwayV2,
        color: "common.white",
        border: "1px solid",
        borderColor: dashboardTokens.border,
      }}
    >
      <Stack spacing={2}>
        {/* Header with title and time filters */}
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
        >
          <Typography variant="h6" fontWeight={700}>
            Financial Overview
          </Typography>
          <ButtonGroup size="small">
            {(["1M", "3M", "6M", "YTD"] as const).map((filter) => (
              <Button
                key={filter}
                onClick={() => setPeriod(filter)}
                variant={period === filter ? "contained" : "outlined"}
                sx={{
                  color:
                    period === filter
                      ? "common.white"
                      : dashboardTokens.textMuted,
                  borderColor: dashboardTokens.borderMuted,
                  fontSize: "0.75rem",
                  minWidth: 40,
                  "&.MuiButton-outlined": {
                    "&:hover": {
                      bgcolor: "rgba(255, 255, 255, 0.05)",
                    },
                  },
                }}
              >
                {filter}
              </Button>
            ))}
          </ButtonGroup>
        </Stack>

        {/* Chart */}
        <Box
          sx={{
            width: "100%",
            height: 280,
          }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={data}
              margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={dashboardTokens.border}
              />
              <XAxis
                dataKey="date"
                stroke={dashboardTokens.textMuted}
                style={{ fontSize: "0.75rem" }}
              />
              <YAxis
                stroke={dashboardTokens.textMuted}
                style={{ fontSize: "0.75rem" }}
                tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: dashboardTokens.surface,
                  border: `1px solid ${dashboardTokens.border}`,
                  borderRadius: 4,
                  color: "white",
                }}
                labelStyle={{ color: "white" }}
                formatter={(value) => [
                  new Intl.NumberFormat("en-NZ", {
                    style: "currency",
                    currency: "NZD",
                  }).format(value as number),
                ]}
              />
              <Line
                type="monotone"
                dataKey="burn"
                stroke="#ff4d6d"
                dot={{ fill: "#ff4d6d", r: 4 }}
                activeDot={{ r: 6 }}
                strokeWidth={2}
                isAnimationActive={true}
              />
            </LineChart>
          </ResponsiveContainer>
        </Box>

        {/* Footer note */}
        <Typography
          variant="caption"
          sx={{ color: dashboardTokens.textMuted, fontSize: "0.7rem" }}
        >
          Showing burn rate trend over {period} period
        </Typography>
      </Stack>
    </Paper>
  );
}
