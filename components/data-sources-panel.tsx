"use client";

import { Box, Chip, Paper, Stack, Typography } from "@mui/material";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import DescriptionIcon from "@mui/icons-material/Description";
import TableChartIcon from "@mui/icons-material/TableChart";
import { dashboardTokens } from "@/app/theme";
import { AccountingConnect } from "@/components/accounting-connect";

const UPCOMING_SOURCES = [
  {
    label: "CSV uploads",
    description: "Upload in chat today. Dashboard metric extraction is next.",
    icon: TableChartIcon,
    status: "Chat ready",
  },
  {
    label: "PDF reports",
    description: "Upload in chat today. Structured extraction is coming later.",
    icon: DescriptionIcon,
    status: "Chat ready",
  },
  {
    label: "Bank feeds",
    description: "Live transaction data for cash visibility",
    icon: AccountBalanceWalletIcon,
    status: "Soon",
  },
];

export function DataSourcesPanel() {
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
      <Stack spacing={2.5}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1.5}
          alignItems={{ xs: "flex-start", sm: "center" }}
          justifyContent="space-between"
        >
          <Stack spacing={0.5}>
            <Typography variant="h6" fontWeight={700}>
              Connect data sources
            </Typography>
            <Typography variant="body2" sx={{ color: dashboardTokens.textMuted }}>
              Connected systems and uploaded files will feed source-aware metrics.
            </Typography>
          </Stack>

          <Chip
            size="small"
            label="Metric extraction next"
            sx={{
              color: dashboardTokens.textSoft,
              borderColor: dashboardTokens.borderMuted,
            }}
            variant="outlined"
          />
        </Stack>

        <AccountingConnect />

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" },
            gap: 1.5,
          }}
        >
          {UPCOMING_SOURCES.map((source) => {
            const Icon = source.icon;

            return (
              <Paper
                key={source.label}
                elevation={0}
                sx={{
                  p: 2,
                  borderRadius: 1,
                  bgcolor: "rgba(255, 255, 255, 0.03)",
                  border: "1px dashed",
                  borderColor: dashboardTokens.borderMuted,
                  color: "common.white",
                  minHeight: 116,
                }}
              >
                <Stack spacing={1.25}>
                  <Stack
                    direction="row"
                    spacing={1}
                    alignItems="center"
                    justifyContent="space-between"
                  >
                    <Box
                      sx={{
                        width: 32,
                        height: 32,
                        borderRadius: 1,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        bgcolor: "rgba(255, 255, 255, 0.06)",
                      }}
                    >
                      <Icon sx={{ fontSize: 18, color: dashboardTokens.textSoft }} />
                    </Box>
                    <Chip
                      size="small"
                      label={source.status}
                      sx={{
                        color: dashboardTokens.textMuted,
                        borderColor: dashboardTokens.border,
                      }}
                      variant="outlined"
                    />
                  </Stack>

                  <Stack spacing={0.5}>
                    <Typography variant="subtitle2" fontWeight={700}>
                      {source.label}
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{ color: dashboardTokens.textMuted }}
                    >
                      {source.description}
                    </Typography>
                  </Stack>
                </Stack>
              </Paper>
            );
          })}
        </Box>
      </Stack>
    </Paper>
  );
}
