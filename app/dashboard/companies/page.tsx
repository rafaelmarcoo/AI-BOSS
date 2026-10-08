import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Box } from "@mui/material";
import { COOKIE_ACCESS_TOKEN } from "@/lib/supabase";
import { getCurrentUserProfile } from "@/lib/auth";
import { dashboardCanvasTokens } from "@/app/theme";
import { DashboardContentTheme } from "../DashboardContentTheme";
import { DashboardHeader } from "../header";
import { CompaniesWorkspace } from "./CompaniesWorkspace";
import { CompanyChatShell } from "./CompanyChatShell";

export default async function CompaniesPage() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(COOKIE_ACCESS_TOKEN)?.value;

  if (!accessToken) redirect("/sign-in");

  const currentUser = await getCurrentUserProfile(accessToken).catch(() => null);
  if (!currentUser) redirect("/sign-in");

  return (
    <Box component="main" sx={{ minHeight: "100vh", bgcolor: dashboardCanvasTokens.shell }}>
      <DashboardHeader />
      <DashboardContentTheme>
        <Box sx={{ maxWidth: 1120, mx: "auto", px: { xs: 2, sm: 4 }, py: { xs: 3, sm: 5 } }}>
          <CompanyChatShell
            fullName={currentUser.profile.full_name}
            email={currentUser.profile.email}
            userType={currentUser.profile.user_type}
          >
            <CompaniesWorkspace />
          </CompanyChatShell>
        </Box>
      </DashboardContentTheme>
    </Box>
  );
}
