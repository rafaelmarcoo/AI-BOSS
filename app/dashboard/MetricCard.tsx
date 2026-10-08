"use client";

import { Box, Chip, Stack, Typography, Skeleton } from "@mui/material";
import { useTheme } from "@mui/material/styles";

interface MetricCardProps {
  label: string;
  value: string | number | null | undefined;
  color: string;
  unit?: string;
  loading?: boolean;
  sourceLabel?: string;
  sourceTone?: "available" | "unavailable" | "derived";
  contextLabel?: string;
  detail?: string | null;
}

export function MetricCard({
  label,
  value,
  color,
  unit,
  loading = false,
  sourceLabel,
  sourceTone = "available",
  contextLabel,
  detail,
}: MetricCardProps) {
  const theme = useTheme();
  const sourceColor =
    sourceTone === "derived"
      ? theme.palette.info.main
      : theme.palette.text.secondary;

  return (
    <Box
      sx={{
        py: 1.5,
        px: { xs: 0, sm: 1 },
        bgcolor: "transparent",
        color: "text.primary",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        minHeight: 128,
      }}
    >
      <Stack spacing={1.5} sx={{ minWidth: 0 }}>
        {/* Header with label and color accent */}
        <Stack
          direction="row"
          alignItems="flex-start"
          justifyContent="space-between"
          spacing={1.5}
        >
          <Stack direction="row" alignItems="center" spacing={1} sx={{ minWidth: 0 }}>
            <Box
              sx={{
                width: 6,
                height: 6,
                borderRadius: 1,
                bgcolor: color,
                flexShrink: 0,
              }}
            />
            <Typography
              variant="body2"
              sx={{
                fontSize: "0.75rem",
                fontWeight: 600,
                letterSpacing: "0.02em",
                color: "text.secondary",
                overflowWrap: "anywhere",
              }}
            >
              {label}
            </Typography>
          </Stack>
          {sourceLabel ? (
            <Chip
              label={sourceLabel}
              size="small"
              variant="outlined"
              sx={{
                maxWidth: 140,
                height: 24,
                borderRadius: "10px",
                color: sourceColor,
                borderColor: "divider",
                "& .MuiChip-label": {
                  px: 0.75,
                  display: "block",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                },
              }}
            />
          ) : null}
        </Stack>

        <Stack spacing={1}>
          {/* Value */}
          {loading ? (
            <Skeleton
              variant="text"
              width="60%"
              height={40}
              sx={{ bgcolor: "action.hover" }}
            />
          ) : (
            <Typography
              variant="h4"
              sx={{
                fontWeight: 700,
                color: "text.primary",
                fontSize: { xs: "1.5rem", sm: "1.65rem" },
                lineHeight: 1,
                overflowWrap: "anywhere",
              }}
            >
              {value ?? "—"}
              {unit && value !== "—" && value !== null && value !== undefined && (
                <Typography
                  component="span"
                  sx={{
                    fontSize: "0.5em",
                    fontWeight: 500,
                    ml: 1,
                    color: "text.secondary",
                  }}
                >
                  {unit}
                </Typography>
              )}
            </Typography>
          )}
          <Typography
            variant="caption"
            sx={{
              color: "text.secondary",
              fontSize: "0.72rem",
              minHeight: 18,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {sourceLabel ? `Source: ${sourceLabel}` : "Source unavailable"}
          </Typography>
          {contextLabel ? (
            <Typography
              variant="caption"
              sx={{ color: sourceColor, fontSize: "0.72rem", lineHeight: 1.45 }}
            >
              {contextLabel}
            </Typography>
          ) : null}
          {detail ? (
            <Typography
              variant="caption"
              sx={{ color: "text.secondary", fontSize: "0.7rem", lineHeight: 1.45 }}
            >
              {detail}
            </Typography>
          ) : null}
        </Stack>
      </Stack>
    </Box>
  );
}
