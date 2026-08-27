"use client";

import { Box, Button, Chip, Paper, Stack, Typography } from "@mui/material";
import DescriptionIcon from "@mui/icons-material/Description";
import GridOnRoundedIcon from "@mui/icons-material/GridOnRounded";
import TableChartIcon from "@mui/icons-material/TableChart";
import { dashboardTokens } from "@/app/theme";

const DOCUMENT_SOURCES = [
  {
    label: "CSV files",
    description: "Deterministic table parsing with explicit metric review.",
    icon: TableChartIcon,
  },
  {
    label: "XLSX workbooks",
    description: "Suggested worksheets, multi-sheet selection, and cached formula values.",
    icon: GridOnRoundedIcon,
  },
  {
    label: "PDF reports",
    description: "Text evidence and conservative metric candidates; scanned files remain previewable.",
    icon: DescriptionIcon,
  },
];

export function DataSourcesPanel() {
  return (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 2, sm: 2.5 },
        borderRadius: 2.5,
        bgcolor: dashboardTokens.surface,
        color: dashboardTokens.text,
        border: "1px solid",
        borderColor: dashboardTokens.border,
      }}
    >
      <Stack spacing={2}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1.5}
          alignItems={{ xs: "flex-start", sm: "center" }}
          justifyContent="space-between"
        >
          <Stack spacing={0.5}>
            <Typography variant="h6" fontWeight={700}>
              Document sources
            </Typography>
            <Typography variant="body2" sx={{ color: dashboardTokens.textMuted }}>
              Upload supported financial files, review extracted candidates, and explicitly approve calculation inputs.
            </Typography>
          </Stack>
          <Button href="/dashboard/documents" variant="outlined">
            Open documents
          </Button>
        </Stack>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" },
            gap: 1.25,
          }}
        >
          {DOCUMENT_SOURCES.map((source) => {
            const Icon = source.icon;
            return (
              <Paper
                key={source.label}
                elevation={0}
                sx={{
                  p: 1.75,
                  borderRadius: 2,
                  bgcolor: "rgba(255,255,255,0.025)",
                  border: "1px solid",
                  borderColor: dashboardTokens.border,
                }}
              >
                <Stack spacing={1}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Icon sx={{ fontSize: 20, color: "#93c5fd" }} />
                    <Chip size="small" label="Supported" color="success" variant="outlined" />
                  </Stack>
                  <Typography variant="subtitle2" fontWeight={700}>{source.label}</Typography>
                  <Typography variant="caption" sx={{ color: dashboardTokens.textMuted, lineHeight: 1.45 }}>
                    {source.description}
                  </Typography>
                </Stack>
              </Paper>
            );
          })}
        </Box>

        <Typography variant="caption" sx={{ color: dashboardTokens.textMuted }}>
          New extracted values remain unreviewed evidence until you choose Include or Exclude and approve them.
        </Typography>
      </Stack>
    </Paper>
  );
}
