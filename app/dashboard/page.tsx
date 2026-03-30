import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { Box } from "@mui/material";
import { COOKIE_ACCESS_TOKEN } from "@/lib/supabase";
import { getCurrentUserProfile } from "@/lib/auth";
import { dashboardTokens } from "@/app/theme";
import { ChatSidebar } from "./chat-sidebar";
import { DashboardHeader } from "./dashboard-header";
import { RunwaySection } from "./runway-section";

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(COOKIE_ACCESS_TOKEN)?.value;

  if (!accessToken) redirect("/sign-in");

  const currentUser = await getCurrentUserProfile(accessToken).catch(
    () => null,
  );

  if (!currentUser) redirect("/sign-in");

  const { profile } = currentUser;

  return (
    <Box
      component="main"
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", md: "360px 1fr" },
        gridTemplateRows: { xs: "50vh 50vh", md: "100vh" },
        height: "100vh",
        overflow: "hidden",
        bgcolor: dashboardTokens.shell,
      }}
    >
      {/* Left: Chat Sidebar */}
      <ChatSidebar fullName={profile.full_name} email={profile.email} />

      {/* Right: Header + Runway */}
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          height: "100%",
          minHeight: 0,
          overflow: "hidden",
          bgcolor: dashboardTokens.surfaceV2,
        }}
      >
        <DashboardHeader />
        <Box sx={{ flex: "1 1 0", minHeight: 0, overflow: "auto" }}>
          <RunwaySection />
        </Box>
      </Box>
    </Box>
  );
}
