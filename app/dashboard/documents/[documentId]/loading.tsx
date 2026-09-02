import { Box, CircularProgress, Stack, Typography } from "@mui/material";
import { dashboardTokens } from "@/app/theme";

export default function DocumentReviewLoading() {
  return (
    <Box sx={{ minHeight: "100vh", bgcolor: dashboardTokens.shell }}>
      <Stack alignItems="center" justifyContent="center" spacing={2} sx={{ minHeight: "70vh" }}>
        <CircularProgress aria-label="Loading document review" />
        <Typography sx={{ color: dashboardTokens.textMuted }}>
          Loading document review…
        </Typography>
      </Stack>
    </Box>
  );
}
