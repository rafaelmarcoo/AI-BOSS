"use client";

import MenuRoundedIcon from "@mui/icons-material/MenuRounded";
import { Box, Button, IconButton, Stack, Typography } from "@mui/material";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignOutButton } from "@/components/sign-out-button";
import { dashboardTokens } from "@/app/theme";

const navigation = [
  { label: "Dashboard", href: "/dashboard", exact: true },
  { label: "Analysis", href: "/dashboard/analysis" },
  { label: "Scenarios", href: "/dashboard/scenarios" },
  { label: "Connections", href: "/dashboard/data-connectors" },
  { label: "Documents", href: "/dashboard/documents" },
  { label: "Companies", href: "/dashboard/companies" },
  { label: "Settings", href: "/dashboard/settings" },
];

interface DashboardHeaderProps {
  onOpenPastChats?: () => void;
}

export function DashboardHeader({ onOpenPastChats }: DashboardHeaderProps = {}) {
  const pathname = usePathname();

  return (
    <Box
      component="header"
      sx={{
        px: { xs: 2, sm: 4, lg: 6 },
        height: 68,
        display: "flex",
        alignItems: "center",
        bgcolor: dashboardTokens.shell,
        borderBottom: "1px solid",
        borderBottomColor: "rgba(255,255,255,0.08)",
        boxShadow: "0 8px 28px rgba(10, 28, 44, 0.12)",
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
          spacing={{ xs: 1, sm: 3.5 }}
          alignItems="center"
          sx={{ minWidth: 0 }}
        >
          {onOpenPastChats ? (
            <IconButton
              aria-label="Open past chats"
              size="small"
              onClick={onOpenPastChats}
              sx={{
                width: 38,
                height: 38,
                borderRadius: `${dashboardTokens.radiusSm}px`,
                color: dashboardTokens.textMuted,
                "&:hover": {
                  color: dashboardTokens.text,
                  bgcolor: "rgba(255,255,255,0.08)",
                },
              }}
            >
              <MenuRoundedIcon fontSize="small" />
            </IconButton>
          ) : null}

          <Typography
            component={Link}
            href="/landing"
            aria-label="AI-BOSS home"
            title="Home"
            sx={{
              color: dashboardTokens.text,
              fontSize: 16,
              fontWeight: 600,
              whiteSpace: "nowrap",
              textDecoration: "none",
            }}
          >
            AI-BOSS
          </Typography>

          <Stack direction="row" spacing={0.25} sx={{ height: 68, alignItems: "stretch" }}>
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
                    px: 1.5,
                    position: "relative",
                    borderRadius: 0,
                    color: active ? dashboardTokens.text : dashboardTokens.textMuted,
                    bgcolor: "transparent",
                    display: {
                      xs: item.exact ? "inline-flex" : "none",
                      sm: "inline-flex",
                    },
                    textTransform: "none",
                    fontSize: 13,
                    fontWeight: 500,
                    "&::after": {
                      content: '\"\"',
                      position: "absolute",
                      right: 12,
                      bottom: 3,
                      left: 12,
                      height: 2,
                      borderRadius: 999,
                      bgcolor: active ? dashboardTokens.accent : "transparent",
                    },
                    "&:hover": {
                      bgcolor: "transparent",
                      color: dashboardTokens.text,
                    },
                    "&:focus-visible": {
                      outline: `2px solid ${dashboardTokens.accent}`,
                      outlineOffset: -4,
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
