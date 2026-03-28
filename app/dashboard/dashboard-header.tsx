import { Box, Button, Stack, Typography } from "@mui/material";
import { SignOutButton } from "@/components/sign-out-button";
import { dashboardTokens } from "@/app/theme";

const NAV_ITEMS = ["Data Connectors", "Scenarios", "Exports", "Settings"];

export function DashboardHeader() {
  return (
    <Box
      sx={{
        px: { xs: 3, sm: 4 },
        py: 3,
        bgcolor: dashboardTokens.sidebarV2,
        borderBottom: "1px solid",
        borderBottomColor: dashboardTokens.border,
      }}
    >
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        alignItems={{ xs: "flex-start", sm: "center" }}
        justifyContent="space-between"
      >
        {/* Left: Title + Nav buttons */}
        <Stack
          direction="row"
          spacing={1.5}
          alignItems="center"
          flexWrap="wrap"
          useFlexGap
        >
          <Stack spacing={0.5}>
            <Typography
              variant="h4"
              component="h1"
              fontWeight={700}
              color="common.white"
            >
              AI-BOSS Platform
            </Typography>
            <Typography
              variant="body2"
              sx={{ color: dashboardTokens.textMuted }}
            >
              Barebones workspace for NZ/AU SME finance teams.
            </Typography>
          </Stack>

          <Button
            variant="contained"
            sx={{ borderRadius: 0.5, color: "common.white" }}
          >
            Dashboard
          </Button>
          {NAV_ITEMS.map((item) => (
            <Button
              key={item}
              sx={{
                color: dashboardTokens.textMuted,
              }}
            >
              {item}
            </Button>
          ))}
        </Stack>

        {/* Right: Sign out */}
        <SignOutButton />
      </Stack>
    </Box>
  );
}
