import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Box, Chip, Stack, Typography } from "@mui/material";
import { COOKIE_ACCESS_TOKEN } from "@/lib/supabase";
import { getCurrentUserProfile } from "@/lib/auth";
import { dashboardTokens } from "@/app/theme";
import { DashboardHeader } from "../header";
import { PasswordSettingsForm } from "./PasswordSettingsForm";

export default async function SettingsPage() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(COOKIE_ACCESS_TOKEN)?.value;
  if (!accessToken) redirect("/sign-in");

  const currentUser = await getCurrentUserProfile(accessToken).catch(() => null);
  if (!currentUser) redirect("/sign-in");

  const { profile } = currentUser;
  return (
    <Box component="main" sx={{ minHeight: "100vh", bgcolor: dashboardTokens.shell }}>
      <DashboardHeader />
      <Stack spacing={3} sx={{ maxWidth: 720, mx: "auto", px: { xs: 2, sm: 4 }, py: { xs: 3, sm: 5 } }}>
        <Stack spacing={0.75}>
          <Typography variant="h5" fontWeight={700} color="common.white">Account settings</Typography>
          <Typography variant="body2" sx={{ color: dashboardTokens.textMuted }}>Manage your AI-BOSS workspace account.</Typography>
        </Stack>
        <Box sx={{ p: { xs: 2, sm: 2.5 }, border: "1px solid", borderColor: dashboardTokens.border, borderRadius: 3, bgcolor: "rgba(255,255,255,0.03)" }}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "center" }} justifyContent="space-between">
            <Stack spacing={0.75}>
              <Typography color="common.white" fontWeight={700}>{profile.full_name ?? "AI-BOSS user"}</Typography>
              <Typography variant="body2" sx={{ color: dashboardTokens.textMuted }}>{profile.email}</Typography>
            </Stack>
            <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
              <Chip size="small" label={`Role: ${profile.user_type ?? "member"}`} sx={{ bgcolor: "rgba(59,130,246,0.18)", color: "#bfdbfe", fontWeight: 600 }} />
              <Chip size="small" label={profile.company_name ?? "No company"} sx={{ bgcolor: "rgba(255,255,255,0.10)", color: "rgba(255,255,255,0.84)", fontWeight: 600 }} />
            </Stack>
          </Stack>
        </Box>
        <PasswordSettingsForm />
      </Stack>
    </Box>
  );
}
