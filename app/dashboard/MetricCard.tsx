import { Box, Paper, Stack, Typography, Skeleton } from "@mui/material";
import { dashboardTokens } from "@/app/theme";

interface MetricCardProps {
  label: string;
  value: string | number | null | undefined;
  color: string;
  unit?: string;
  loading?: boolean;
}

export function MetricCard({
  label,
  value,
  color,
  unit,
  loading = false,
}: MetricCardProps) {
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
        minHeight: 140,
      }}
    >
      <Stack spacing={2}>
        {/* Header with label and color accent */}
        <Stack direction="row" alignItems="center" spacing={1.5}>
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
            }}
          >
            {label}
          </Typography>
        </Stack>

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
            }}
          >
            {value ?? "—"}
            {unit && (
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
      </Stack>
    </Paper>
  );
}
