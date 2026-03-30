import { Box, Button, Stack, Typography } from "@mui/material";
import { SignOutButton } from "@/components/sign-out-button";
import { dashboardTokens } from "@/app/theme";

const NAV_ITEMS = ["Data Connectors", "Scenarios", "Exports", "Settings"];

export function DashboardHeader() {
  return (
    <Box
      sx={{
        px: { xs: 2, sm: 4 },
        py: { xs: 1.5, sm: 3 },
        bgcolor: dashboardTokens.sidebarV2,
        borderBottom: "1px solid",
        borderBottomColor: dashboardTokens.border,
      }}
    >
      <Stack
        direction="row"
        spacing={2}
        alignItems="center"
        justifyContent="space-between"
      >
        {/* Left: Title + Nav */}
        <Stack
          direction="row"
          spacing={1.5}
          alignItems="center"
          flexWrap="wrap"
          useFlexGap
          sx={{ minWidth: 0 }}
        >
          {/* Title — hide subtitle on small screens */}
          <Stack spacing={0.25}>
            <Typography
              variant={{ xs: "h6", sm: "h4" } as any}
              component="h1"
              fontWeight={700}
              color="common.white"
              sx={{ fontSize: { xs: "1rem", sm: undefined } }}
            >
              AI-BOSS
            </Typography>
            <Typography
              variant="body2"
              sx={{
                color: dashboardTokens.textMuted,
                display: { xs: "none", sm: "block" },
              }}
            >
              Barebones workspace for NZ/AU SME finance teams.
            </Typography>
          </Stack>

          <Button
            variant="contained"
            size="small"
            sx={{ borderRadius: 0.5, color: "common.white" }}
          >
            Dashboard
          </Button>

          {/* Nav items — hide on xs */}
          {NAV_ITEMS.map((item) => (
            <Button
              key={item}
              size="small"
              sx={{
                color: dashboardTokens.textMuted,
                display: { xs: "none", sm: "inline-flex" },
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
