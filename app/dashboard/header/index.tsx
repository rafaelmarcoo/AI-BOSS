"use client";

import { Box, Button, Stack, Typography } from "@mui/material";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignOutButton } from "@/components/sign-out-button";
import { dashboardTokens } from "@/app/theme";

const navigation = [
  { label: "Dashboard", href: "/dashboard", exact: true },
  { label: "Documents", href: "/dashboard/documents" },
  { label: "Settings", href: "/dashboard/settings" },
];

export function DashboardHeader() {
  const pathname = usePathname();

  return (
    <Box
      component="header"
      sx={{
        px: { xs: 1.5, sm: 2.5 },
        height: 56,
        display: "flex",
        alignItems: "center",
        bgcolor: dashboardTokens.sidebar,
        borderBottom: "1px solid",
        borderBottomColor: dashboardTokens.border,
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ width: "100%", minWidth: 0 }}
      >
        <Stack
          direction="row"
          spacing={{ xs: 1, sm: 2.5 }}
          alignItems="center"
          sx={{ minWidth: 0 }}
        >
          <Typography
            component="span"
            sx={{
              color: dashboardTokens.text,
              fontSize: 17,
              fontWeight: 650,
              letterSpacing: "-0.02em",
              whiteSpace: "nowrap",
            }}
          >
            AI-BOSS
          </Typography>

          <Box sx={{ width: "1px", height: 20, bgcolor: dashboardTokens.border }} />

          <Stack direction="row" spacing={0.25}>
            {navigation.map((item) => {
              const active = item.exact
                ? pathname === item.href
                : pathname.startsWith(item.href);

              return (
                <Button
                  key={item.href}
                  component={Link}
                  href={item.href}
                  size="small"
                  sx={{
                    minHeight: 32,
                    minWidth: 0,
                    px: 1.25,
                    borderRadius: `${dashboardTokens.radiusSm}px`,
                    color: active ? dashboardTokens.text : dashboardTokens.textMuted,
                    bgcolor: active ? dashboardTokens.surfaceAlt : "transparent",
                    display: {
                      xs: item.exact ? "inline-flex" : "none",
                      sm: "inline-flex",
                    },
                    textTransform: "none",
                    fontSize: 13,
                    fontWeight: active ? 600 : 500,
                    "&:hover": {
                      bgcolor: dashboardTokens.surfaceAlt,
                      color: dashboardTokens.text,
                    },
                  }}
                >
                  {item.label}
                </Button>
              );
            })}
          </Stack>
        </Stack>

        <SignOutButton />
      </Stack>
    </Box>
  );
}
