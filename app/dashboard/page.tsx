import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { Box, Container, Paper } from "@mui/material";
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
    <Box component="main" sx={{ bgcolor: dashboardTokens.shell }}>
      <Container
        disableGutters
        maxWidth={false}
        sx={{ height: "100vh", width: "100vw" }}
      >
        <Paper
          elevation={0}
          sx={{
            height: "100%",
            overflow: "hidden",
            borderColor: dashboardTokens.border,
            bgcolor: dashboardTokens.shell,
          }}
        >
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "360px 1fr" },
              height: "100%",
            }}
          >
            {/* Left: Chat Sidebar */}
            <ChatSidebar fullName={profile.full_name} email={profile.email} />

            {/* Right: Header + Runway */}
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                bgcolor: dashboardTokens.surfaceV2,
              }}
            >
              <DashboardHeader />
              <RunwaySection />
            </Box>
          </Box>
        </Paper>
      </Container>
    </Box>
  );
}
