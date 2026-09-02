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
        p: 2,
        borderRadius: `${dashboardTokens.radiusMd}px`,
        bgcolor: dashboardTokens.surface,
        color: dashboardTokens.text,
        border: "1px solid",
        borderColor: dashboardTokens.border,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        minHeight: 148,
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
                color: dashboardTokens.textMuted,
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
                borderRadius: `${dashboardTokens.radiusSm}px`,
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
              sx={{ color: dashboardTokens.textMuted, fontSize: "0.7rem", lineHeight: 1.45 }}
            >
              {detail}
            </Typography>
          ) : null}
        </Stack>
      </Stack>
    </Paper>
  );
}
