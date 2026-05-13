import { Box, Chip, Paper, Stack, Typography, Skeleton } from "@mui/material";
import { dashboardTokens } from "@/app/theme";

interface MetricCardProps {
  label: string;
  value: string | number | null | undefined;
  color: string;
  unit?: string;
  loading?: boolean;
  sourceLabel?: string;
  sourceTone?: "available" | "unavailable" | "derived";
}

export function MetricCard({
  label,
  value,
  color,
  unit,
  loading = false,
  sourceLabel,
  sourceTone = "available",
}: MetricCardProps) {
  const sourceColor =
    sourceTone === "available"
      ? dashboardTokens.textSoft
      : sourceTone === "derived"
        ? "#93c5fd"
        : dashboardTokens.textMuted;

  return (
    <Paper
      elevation={0}
      sx={{
        p: 2.5,
        borderRadius: 1,
        bgcolor: dashboardTokens.runwayV2,
        color: "common.white",
        border: "1px solid",
        borderColor: dashboardTokens.border,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        minHeight: 156,
      }}
    >
      <Stack spacing={2} sx={{ minWidth: 0 }}>
        {/* Header with label and color accent */}
        <Stack
          direction="row"
          alignItems="flex-start"
          justifyContent="space-between"
          spacing={1.5}
        >
          <Stack direction="row" alignItems="center" spacing={1.5} sx={{ minWidth: 0 }}>
            <Box
              sx={{
                width: 12,
                height: 12,
                borderRadius: "50%",
                bgcolor: color,
                flexShrink: 0,
              }}
            />
            <Typography
              variant="body2"
              sx={{
                fontSize: "0.75rem",
                fontWeight: 600,
                letterSpacing: "0.05em",
                color: dashboardTokens.textMuted,
                textTransform: "uppercase",
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
                height: 22,
                color: sourceColor,
                borderColor:
                  sourceTone === "unavailable"
                    ? dashboardTokens.border
                    : dashboardTokens.borderMuted,
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
              sx={{ bgcolor: "rgba(255, 255, 255, 0.1)" }}
            />
          ) : (
            <Typography
              variant="h4"
              sx={{
                fontWeight: 700,
                fontSize: { xs: "1.75rem", sm: "2rem" },
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
                    color: dashboardTokens.textMuted,
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
              color: dashboardTokens.textMuted,
              fontSize: "0.72rem",
              minHeight: 18,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {sourceLabel ? `Source: ${sourceLabel}` : "Source unavailable"}
          </Typography>
        </Stack>
      </Stack>
    </Paper>
  );
}
