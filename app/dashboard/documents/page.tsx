import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Box } from "@mui/material";
import { COOKIE_ACCESS_TOKEN } from "@/lib/supabase";
import { getCurrentUserProfile } from "@/lib/auth";
import { dashboardTokens } from "@/app/theme";
import { DashboardHeader } from "../header";
import { DocumentsWorkspace } from "./DocumentsWorkspace";

export default async function DocumentsPage() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(COOKIE_ACCESS_TOKEN)?.value;

  if (!accessToken) redirect("/sign-in");

  const currentUser = await getCurrentUserProfile(accessToken).catch(() => null);
  if (!currentUser) redirect("/sign-in");

  return (
    <Box component="main" sx={{ minHeight: "100vh", bgcolor: dashboardTokens.shell }}>
      <DashboardHeader />
      <Box sx={{ maxWidth: 1120, mx: "auto", px: { xs: 2, sm: 4 }, py: { xs: 3, sm: 5 } }}>
        <DocumentsWorkspace />
      </Box>
    </Box>
  );
}
