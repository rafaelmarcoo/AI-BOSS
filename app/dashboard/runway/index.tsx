import {
  Box,
  Button,
  ButtonGroup,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import BarChartIcon from "@mui/icons-material/BarChart";
import { dashboardTokens } from "@/app/theme";

const METRIC_CARDS = [
  { label: "MONTHS LEFT", color: "#00e5a0" },
  { label: "DAILY BURN", color: "#4da6ff" },
  { label: "NET LOSS", color: "#ff4d6d" },
];

const TIME_FILTERS = ["1M", "3M", "6M", "YTD"];

export function RunwaySection() {
  return (
    <Box sx={{ p: { xs: 3, sm: 4 }, flex: 1 }}>
      <Stack spacing={3}>
        {/* Runway Status Header Card */}
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
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
          >
            <Stack direction="row" alignItems="center" spacing={2}>
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: 2,
                  bgcolor: dashboardTokens.surface,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <TrendingUpIcon sx={{ color: "common.white", fontSize: 20 }} />
              </Box>
              <Stack spacing={0.5}>
                <Typography variant="h6" fontWeight={700}>
                  Runway Status
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ color: dashboardTokens.textMuted }}
                >
                  This area will eventually hold summary cards, charts, and
                  ledger tabs.
                </Typography>
              </Stack>
            </Stack>
            <Button
              size="small"
              variant="outlined"
              sx={{
                borderRadius: 999,
                color: "common.white",
                borderColor: dashboardTokens.borderMuted,
                fontSize: "0.75rem",
              }}
            >
              Live
            </Button>
          </Stack>
        </Paper>

        {/* Metric Cards */}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" },
            gap: 2,
          }}
        >
          {METRIC_CARDS.map(({ label, color }) => (
            <Paper
              key={label}
              elevation={0}
              sx={{
                p: 2.5,
                borderRadius: 1,
                bgcolor: dashboardTokens.runwayV2,
                color: "common.white",
                border: "1px solid",
                borderColor: dashboardTokens.border,
                minHeight: 120,
              }}
            >
              <Stack spacing={1.5}>
                <Typography
                  variant="caption"
                  sx={{ color: dashboardTokens.textMuted, letterSpacing: 1 }}
                >
                  {label}
                </Typography>
                <Box
                  sx={{
                    width: 32,
                    height: 3,
                    borderRadius: 999,
                    bgcolor: color,
                  }}
                />
                <Typography
                  variant="body2"
                  sx={{ color: dashboardTokens.textMuted }}
                >
                  Connect data source to populate
                </Typography>
              </Stack>
            </Paper>
          ))}
        </Box>

        {/* Financial Overview Card */}
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
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
            >
              <Typography variant="h6" fontWeight={700}>
                Financial Overview
              </Typography>
              <ButtonGroup size="small">
                {TIME_FILTERS.map((filter) => (
                  <Button
                    key={filter}
                    variant={filter === "3M" ? "contained" : "outlined"}
                    sx={{
                      color:
                        filter === "3M"
                          ? "common.white"
                          : dashboardTokens.textMuted,
                      borderColor: dashboardTokens.borderMuted,
                      fontSize: "0.75rem",
                      minWidth: 40,
                    }}
                  >
                    {filter}
                  </Button>
                ))}
              </ButtonGroup>
            </Stack>

            <Box
              sx={{
                height: 160,
                border: "1px solid",
                borderColor: dashboardTokens.border,
                borderRadius: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 1,
              }}
            >
              <BarChartIcon
                sx={{ color: dashboardTokens.textMuted, fontSize: 32 }}
              />
              <Typography
                variant="body2"
                sx={{ color: dashboardTokens.textMuted }}
              >
                Connect a data source to see your charts
              </Typography>
            </Box>
          </Stack>
        </Paper>
      </Stack>
    </Box>
  );
}
