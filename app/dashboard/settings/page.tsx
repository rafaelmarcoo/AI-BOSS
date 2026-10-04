import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Alert, Box, Chip, Stack, Typography } from "@mui/material";
import { COOKIE_ACCESS_TOKEN } from "@/lib/supabase";
import { getCurrentUserProfile } from "@/lib/auth";
import { getCompanyJoinCodeForAdmin } from "@/lib/companies";
import { dashboardCanvasTokens as dashboardTokens } from "@/app/theme";
import { DashboardContentTheme } from "../DashboardContentTheme";
import { DashboardHeader } from "../header";
import { PasswordSettingsForm } from "./PasswordSettingsForm";
import { CompanyJoinCodeCard } from "./CompanyJoinCodeCard";
import { GenUiPreferencesForm } from "./GenUiPreferencesForm";
import { getGenUiPersonalization } from "@/lib/gen-ui/preferences-persistence";

export default async function SettingsPage() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(COOKIE_ACCESS_TOKEN)?.value;
  if (!accessToken) redirect("/sign-in");

  const currentUser = await getCurrentUserProfile(accessToken).catch(() => null);
  if (!currentUser) redirect("/sign-in");

  const { profile, user } = currentUser;
  const companyJoinCode = profile.user_type === "admin"
    ? await getCompanyJoinCodeForAdmin(user.id).catch(() => null)
    : null;
  const personalization = await getGenUiPersonalization(user.id);
  return (
    <Box component="main" sx={{ minHeight: "100vh", bgcolor: dashboardTokens.shell }}>
      <DashboardHeader />
      <DashboardContentTheme>
        <Stack spacing={3} sx={{ maxWidth: 860, mx: "auto", px: { xs: 2, sm: 4 }, py: { xs: 3, sm: 5 } }}>
          <Stack spacing={0.75}>
            <Typography variant="h5" fontWeight={700} color={dashboardTokens.text}>Account settings</Typography>
            <Typography variant="body2" sx={{ color: dashboardTokens.textMuted }}>Manage your AI-BOSS workspace account.</Typography>
          </Stack>
          <Box sx={{ p: { xs: 2, sm: 2.5 }, border: "1px solid", borderColor: dashboardTokens.border, borderRadius: 3, bgcolor: dashboardTokens.surface, boxShadow: "0 8px 24px rgba(32, 58, 80, 0.08)" }}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "center" }} justifyContent="space-between">
              <Stack spacing={0.75}>
                <Typography color={dashboardTokens.text} fontWeight={700}>{profile.full_name ?? "AI-BOSS user"}</Typography>
                <Typography variant="body2" sx={{ color: dashboardTokens.textMuted }}>{profile.email}</Typography>
              </Stack>
              <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                <Chip size="small" label={`Role: ${profile.user_type ?? "member"}`} sx={{ bgcolor: "rgba(43,106,155,0.10)", color: "#2B6A9B", fontWeight: 600 }} />
                <Chip size="small" label={profile.company_name ?? "No company"} sx={{ bgcolor: dashboardTokens.surfaceAlt, color: dashboardTokens.textSoft, fontWeight: 600 }} />
              </Stack>
            </Stack>
          </Box>
          {profile.user_type === "admin" ? (
            companyJoinCode ? (
              <CompanyJoinCodeCard
                code={companyJoinCode.code}
                expiresAt={companyJoinCode.expiresAt}
              />
            ) : (
              <Alert severity="error">
                The employee join code is currently unavailable.
              </Alert>
            )
          ) : null}
          <GenUiPreferencesForm initialPreferences={personalization} />
          <PasswordSettingsForm />
        </Stack>
      </DashboardContentTheme>
    </Box>
  );
}
