"use client";

import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import DashboardRoundedIcon from "@mui/icons-material/DashboardRounded";
import DescriptionRoundedIcon from "@mui/icons-material/DescriptionRounded";
import HomeRoundedIcon from "@mui/icons-material/HomeRounded";
import MenuRoundedIcon from "@mui/icons-material/MenuRounded";
import RouteRoundedIcon from "@mui/icons-material/RouteRounded";
import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded";
import {
  Avatar,
  Box,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  Typography,
} from "@mui/material";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { dashboardTokens } from "@/app/theme";
import { SignOutButton } from "@/components/sign-out-button";

export const LANDING_BACKGROUND = "#102A43";
const HEADER_BACKGROUND = LANDING_BACKGROUND;
const HEADER_SURFACE = "#193B5A";
const HEADER_TEXT = "#FAF9FC";
const HEADER_MUTED_TEXT = "#B8C7D9";
const HEADER_ACCENT = "#E98761";
const LANDING_FONT_FAMILY =
  'var(--font-poppins), Poppins, "Segoe UI", sans-serif';

const navigation = [
  { label: "Home", href: "/landing", icon: HomeRoundedIcon, exact: true },
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: DashboardRoundedIcon,
    exact: true,
  },
  { label: "Scenarios", href: "/dashboard/scenarios", icon: RouteRoundedIcon },
  {
    label: "Documents",
    href: "/dashboard/documents",
    icon: DescriptionRoundedIcon,
  },
  { label: "Settings", href: "/dashboard/settings", icon: SettingsRoundedIcon },
];

interface LandingWelcomeHeaderProps {
  fullName: string | null;
  email: string;
}

function getDisplayName(fullName: string | null, email: string) {
  return fullName?.trim() || email.split("@")[0] || "there";
}

function getInitials(displayName: string) {
  const nameParts = displayName.trim().split(/\s+/).filter(Boolean);

  if (nameParts.length === 1) {
    return nameParts[0].slice(0, 2).toUpperCase();
  }

  return `${nameParts[0][0]}${nameParts.at(-1)?.[0] ?? ""}`.toUpperCase();
}

export function LandingWelcomeHeader({
  fullName,
  email,
}: LandingWelcomeHeaderProps) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const displayName = getDisplayName(fullName, email);
  const firstName = displayName.split(/\s+/)[0];
  const initials = getInitials(displayName);

  return (
    <>
      <Box
        component="header"
        sx={{
          height: { xs: 68, sm: 72 },
          display: "flex",
          alignItems: "center",
          bgcolor: HEADER_BACKGROUND,
          color: HEADER_TEXT,
          "& .MuiTypography-root, & .MuiButtonBase-root": {
            fontFamily: LANDING_FONT_FAMILY,
          },
        }}
      >
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          sx={{
            width: "100%",
            maxWidth: dashboardTokens.contentMaxWidth,
            minWidth: 0,
            mx: "auto",
            px: { xs: 2, sm: 4, lg: 6 },
          }}
        >
          <Stack direction="row" spacing={1.25} alignItems="center" minWidth={0}>
            <Avatar
              aria-label={`${displayName} profile`}
              sx={{
                width: 40,
                height: 40,
                bgcolor: HEADER_ACCENT,
                color: "#272333",
                border: "3px solid #B978D0",
                fontSize: 13,
                fontWeight: 600,
                letterSpacing: "0.02em",
              }}
            >
              {initials}
            </Avatar>
            <Typography
              component="p"
              sx={{
                color: HEADER_TEXT,
                fontSize: { xs: 15, sm: 16 },
                fontWeight: 500,
                lineHeight: 1.2,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              Hello, {firstName}!
            </Typography>
          </Stack>

          <IconButton
            type="button"
            aria-label="Open navigation menu"
            aria-expanded={menuOpen}
            aria-controls={menuOpen ? "landing-navigation-drawer" : undefined}
            onClick={() => setMenuOpen(true)}
            sx={{
              width: 40,
              height: 40,
              ml: 2,
              flex: "0 0 auto",
              borderRadius: "12px",
              color: HEADER_TEXT,
              bgcolor: HEADER_SURFACE,
              border: "1px solid rgba(255, 255, 255, 0.08)",
              "&:hover": { bgcolor: "#244B6A" },
              "&:focus-visible": {
                outline: `3px solid ${HEADER_ACCENT}`,
                outlineOffset: 2,
              },
            }}
          >
            <MenuRoundedIcon />
          </IconButton>
        </Stack>
      </Box>

      <Drawer
        id="landing-navigation-drawer"
        anchor="right"
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        slotProps={{
          paper: {
            sx: {
              width: { xs: "min(88vw, 320px)", sm: 340 },
              bgcolor: HEADER_BACKGROUND,
              color: HEADER_TEXT,
              backgroundImage: "none",
              borderLeft: "1px solid rgba(255, 255, 255, 0.1)",
              "& .MuiTypography-root, & .MuiButtonBase-root": {
                fontFamily: LANDING_FONT_FAMILY,
              },
            },
          },
        }}
      >
        <Stack sx={{ height: "100%" }}>
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            sx={{ minHeight: 72, px: 2.25 }}
          >
            <Typography
              sx={{ fontSize: 17, fontWeight: 600, letterSpacing: "-0.02em" }}
            >
              AI-BOSS
            </Typography>
            <IconButton
              aria-label="Close navigation menu"
              onClick={() => setMenuOpen(false)}
              sx={{ color: HEADER_MUTED_TEXT }}
            >
              <CloseRoundedIcon />
            </IconButton>
          </Stack>

          <Divider sx={{ borderColor: "rgba(255, 255, 255, 0.1)" }} />

          <Stack
            direction="row"
            spacing={1.5}
            alignItems="center"
            sx={{ px: 2.25, py: 2 }}
          >
            <Avatar
              sx={{
                width: 46,
                height: 46,
                bgcolor: HEADER_ACCENT,
                color: "#272333",
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              {initials}
            </Avatar>
            <Box sx={{ minWidth: 0 }}>
              <Typography fontWeight={500} noWrap>
                {displayName}
              </Typography>
              <Typography sx={{ color: HEADER_MUTED_TEXT, fontSize: 12 }} noWrap>
                {email}
              </Typography>
            </Box>
          </Stack>

          <List
            component="nav"
            aria-label="Main navigation"
            sx={{ px: 1.25, py: 0.5 }}
          >
            {navigation.map((item) => {
              const active = item.exact
                ? pathname === item.href
                : pathname.startsWith(item.href);
              const Icon = item.icon;

              return (
                <ListItemButton
                  key={item.href}
                  component={Link}
                  href={item.href}
                  selected={active}
                  onClick={() => setMenuOpen(false)}
                  sx={{
                    minHeight: 48,
                    mb: 0.5,
                    borderRadius: "12px",
                    color: active ? HEADER_TEXT : HEADER_MUTED_TEXT,
                    "&.Mui-selected": { bgcolor: HEADER_SURFACE },
                    "&.Mui-selected:hover, &:hover": {
                      bgcolor: "#244B6A",
                      color: HEADER_TEXT,
                    },
                    "&:focus-visible": {
                      outline: `3px solid ${HEADER_ACCENT}`,
                      outlineOffset: -2,
                    },
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 38, color: "inherit" }}>
                    <Icon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText
                    primary={item.label}
                    slotProps={{
                      primary: {
                        fontSize: 14,
                        fontWeight: 400,
                      },
                    }}
                  />
                </ListItemButton>
              );
            })}
          </List>

          <Box sx={{ mt: "auto", px: 1.25, pb: 2 }}>
            <Divider
              sx={{ mb: 1, borderColor: "rgba(255, 255, 255, 0.1)" }}
            />
            <SignOutButton />
          </Box>
        </Stack>
      </Drawer>
    </>
  );
}
