import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Box } from "@mui/material";
import { COOKIE_ACCESS_TOKEN } from "@/lib/supabase";
import { getCurrentUserProfile } from "@/lib/auth";
import { dashboardCanvasTokens } from "@/app/theme";
import { DashboardContentTheme } from "../../DashboardContentTheme";
import { DashboardHeader } from "../../header";
import { CompareWorkspace } from "./CompareWorkspace";
import { CompanyChatShell } from "../CompanyChatShell";

interface ComparePageProps {
  searchParams?: Promise<{ first?: string; second?: string }>;
}

export default async function ComparePage({ searchParams }: ComparePageProps) {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(COOKIE_ACCESS_TOKEN)?.value;
  const params = await searchParams;

  if (!accessToken) redirect("/sign-in");

  const currentUser = await getCurrentUserProfile(accessToken).catch(() => null);
  if (!currentUser) redirect("/sign-in");

  return (
    <Box component="main" sx={{ minHeight: "100vh", bgcolor: dashboardCanvasTokens.shell }}>
      <Box className="no-print">
        <DashboardHeader />
      </Box>
      <DashboardContentTheme>
        <Box sx={{ maxWidth: 1120, mx: "auto", px: { xs: 2, sm: 4 }, py: { xs: 3, sm: 5 } }}>
          <CompanyChatShell
            fullName={currentUser.profile.full_name}
            email={currentUser.profile.email}
            userType={currentUser.profile.user_type}
          >
            <CompareWorkspace initialFirst={params?.first ?? null} initialSecond={params?.second ?? null} />
          </CompanyChatShell>
        </Box>
      </DashboardContentTheme>
    </Box>
  );
}
