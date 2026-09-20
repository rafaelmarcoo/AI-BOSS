"use client";

import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import KeyboardArrowDownRoundedIcon from "@mui/icons-material/KeyboardArrowDownRounded";
import MenuRoundedIcon from "@mui/icons-material/MenuRounded";
import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded";
import {
  Avatar,
  Box,
  ButtonBase,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  Typography,
} from "@mui/material";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { SignOutButton } from "@/components/sign-out-button";

export const LANDING_BACKGROUND = "#102A43";
export const LANDING_SECONDARY = "#F28C5B";

const HEADER_TEXT = "#FAF9FC";
const HEADER_MUTED_TEXT = "#B8C7D9";
const LANDING_FONT_FAMILY =
  'var(--font-poppins), Poppins, "Segoe UI", sans-serif';

const navigation = [
  { label: "Home", href: "/landing", exact: true },
  { label: "Dashboard", href: "/dashboard", exact: true },
  { label: "Scenarios", href: "/dashboard/scenarios" },
  { label: "Documents", href: "/dashboard/documents" },
];

interface LandingWelcomeHeaderProps {
  fullName: string | null;
  email: string;
  companyName: string | null;
}

function getDisplayName(fullName: string | null, email: string) {
  return fullName?.trim() || email.split("@")[0] || "AI-BOSS user";
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
  companyName,
}: LandingWelcomeHeaderProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileAnchor, setProfileAnchor] = useState<HTMLElement | null>(null);
  const displayName = getDisplayName(fullName, email);
  const initials = getInitials(displayName);
  const organisationLabel = companyName?.trim() || email;

  const isActive = (item: (typeof navigation)[number]) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href);

  return (
    <Box
      component="header"
      sx={{
        height: 68,
        display: "flex",
        alignItems: "center",
        flex: "0 0 auto",
        bgcolor: LANDING_BACKGROUND,
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
          width: { xs: "100%", md: "75%" },
          minWidth: 0,
          mx: "auto",
          px: { xs: 2, sm: 4, lg: 6 },
        }}
      >
        <Stack direction="row" alignItems="center" spacing={{ xs: 1.5, md: 3.5 }}>
          <Typography
            component={Link}
            href="/landing"
            aria-label="AI-BOSS home"
            sx={{
              color: HEADER_TEXT,
              fontSize: 16,
              fontWeight: 600,
              whiteSpace: "nowrap",
              textDecoration: "none",
            }}
          >
            AI-BOSS
          </Typography>

          <Stack
            component="nav"
            aria-label="Primary navigation"
            direction="row"
            alignItems="stretch"
            sx={{ display: { xs: "none", md: "flex" }, height: 68 }}
          >
            {navigation.map((item) => {
              const active = isActive(item);

              return (
                <ButtonBase
                  key={item.href}
                  component={Link}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  sx={{
                    position: "relative",
                    px: 1.75,
                    color: active ? HEADER_TEXT : HEADER_MUTED_TEXT,
                    fontSize: 13,
                    fontWeight: 500,
                    textDecoration: "none",
                    "&::after": {
                      content: '""',
                      position: "absolute",
                      right: 14,
                      bottom: 3,
                      left: 14,
                      height: 2,
                      borderRadius: 999,
                      bgcolor: active ? LANDING_SECONDARY : "transparent",
                    },
                    "&:hover": { color: HEADER_TEXT },
                    "&:focus-visible": {
                      outline: `2px solid ${LANDING_SECONDARY}`,
                      outlineOffset: -4,
                    },
                  }}
                >
                  {item.label}
                </ButtonBase>
              );
            })}
          </Stack>
        </Stack>

        <Stack direction="row" alignItems="center" spacing={{ xs: 0.5, sm: 1.25 }}>
          <ButtonBase
            aria-label="Open profile menu"
            aria-expanded={Boolean(profileAnchor)}
            onClick={(event) => setProfileAnchor(event.currentTarget)}
            sx={{
              minHeight: 44,
              gap: 1,
              px: { xs: 0.25, sm: 0.75 },
              borderRadius: "10px",
              color: HEADER_TEXT,
              "&:hover": { bgcolor: "rgba(255,255,255,0.07)" },
              "&:focus-visible": {
                outline: `2px solid ${LANDING_SECONDARY}`,
                outlineOffset: 2,
              },
            }}
          >
            <Avatar
              sx={{
                width: 34,
                height: 34,
                bgcolor: "#FFD1C3",
                color: LANDING_BACKGROUND,
                fontSize: 11,
                fontWeight: 500,
              }}
            >
              {initials}
            </Avatar>
            <Box sx={{ display: { xs: "none", sm: "block" }, minWidth: 0, textAlign: "left" }}>
              <Typography sx={{ maxWidth: 150, fontSize: 12, fontWeight: 500 }} noWrap>
                {displayName}
              </Typography>
              <Typography
                sx={{ maxWidth: 150, color: HEADER_MUTED_TEXT, fontSize: 11, fontWeight: 400 }}
                noWrap
              >
                {organisationLabel}
              </Typography>
            </Box>
            <KeyboardArrowDownRoundedIcon
              sx={{ display: { xs: "none", sm: "block" }, color: HEADER_MUTED_TEXT, fontSize: 18 }}
            />
          </ButtonBase>

          <IconButton
            aria-label="Open navigation menu"
            onClick={() => setMobileMenuOpen(true)}
            sx={{
              display: { xs: "inline-flex", md: "none" },
              color: HEADER_TEXT,
              "&:hover": { bgcolor: "rgba(255,255,255,0.08)" },
            }}
          >
            <MenuRoundedIcon />
          </IconButton>
        </Stack>
      </Stack>

      <Menu
        anchorEl={profileAnchor}
        open={Boolean(profileAnchor)}
        onClose={() => setProfileAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{
          paper: {
            sx: {
              mt: 0.75,
              minWidth: 210,
              bgcolor: "#173953",
              color: HEADER_TEXT,
              border: "1px solid rgba(255,255,255,0.1)",
              "& .MuiTypography-root, & .MuiButtonBase-root": {
                fontFamily: LANDING_FONT_FAMILY,
              },
            },
          },
        }}
      >
        <MenuItem
          component={Link}
          href="/dashboard/settings"
          onClick={() => setProfileAnchor(null)}
          sx={{ gap: 1.25, fontSize: 13, fontWeight: 500, color: HEADER_TEXT }}
        >
          <SettingsRoundedIcon fontSize="small" />
          Settings
        </MenuItem>
        <Divider sx={{ borderColor: "rgba(255,255,255,0.1)" }} />
        <Box sx={{ px: 0.75 }}>
          <SignOutButton />
        </Box>
      </Menu>

      <Drawer
        anchor="right"
        open={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        slotProps={{
          paper: {
            sx: {
              width: "min(86vw, 320px)",
              bgcolor: LANDING_BACKGROUND,
              color: HEADER_TEXT,
              backgroundImage: "none",
              "& .MuiTypography-root, & .MuiButtonBase-root": {
                fontFamily: LANDING_FONT_FAMILY,
              },
            },
          },
        }}
      >
        <Stack sx={{ height: "100%", p: 1.5 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
            <Typography sx={{ px: 1, fontSize: 16, fontWeight: 600 }}>AI-BOSS</Typography>
            <IconButton
              aria-label="Close navigation menu"
              onClick={() => setMobileMenuOpen(false)}
              sx={{ color: HEADER_MUTED_TEXT }}
            >
              <CloseRoundedIcon />
            </IconButton>
          </Stack>
          <List component="nav" aria-label="Mobile navigation" disablePadding>
            {navigation.map((item) => {
              const active = isActive(item);

              return (
                <ListItemButton
                  key={item.href}
                  component={Link}
                  href={item.href}
                  selected={active}
                  onClick={() => setMobileMenuOpen(false)}
                  sx={{
                    minHeight: 46,
                    mb: 0.5,
                    borderRadius: "10px",
                    color: active ? HEADER_TEXT : HEADER_MUTED_TEXT,
                    borderLeft: "3px solid",
                    borderLeftColor: active ? LANDING_SECONDARY : "transparent",
                    "&.Mui-selected, &.Mui-selected:hover, &:hover": {
                      bgcolor: "rgba(255,255,255,0.07)",
                    },
                  }}
                >
                  <ListItemText
                    primary={item.label}
                    slotProps={{ primary: { fontSize: 13, fontWeight: 500 } }}
                  />
                </ListItemButton>
              );
            })}
          </List>
          <Box sx={{ mt: "auto", px: 0.5 }}>
            <Divider sx={{ mb: 1, borderColor: "rgba(255,255,255,0.1)" }} />
            <SignOutButton />
          </Box>
        </Stack>
      </Drawer>
    </Box>
  );
}
