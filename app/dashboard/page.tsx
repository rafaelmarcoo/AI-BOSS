import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { Box } from "@mui/material";
import { COOKIE_ACCESS_TOKEN } from "@/lib/supabase";
import { getCurrentUserProfile } from "@/lib/auth";
import { dashboardTokens } from "@/app/theme";
import { ChatSidebar } from "./chat/sidebar";
import { DashboardHeader } from "./header";
import { RunwaySection } from "./runway";

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
        bgcolor: dashboardTokens.shell,
        // Desktop: locked to viewport, no page scroll
        height: { md: "100vh" },
        overflow: { md: "hidden" },
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header — sticky on mobile so it stays visible while scrolling */}
      <Box
        sx={{
          flex: "0 0 auto",
          position: { xs: "sticky", md: "relative" },
          top: 0,
          zIndex: 10,
        }}
      >
        <DashboardHeader />
      </Box>

      {/* Body */}
      <Box
        sx={{
          flex: { md: "1 1 0" },
          minHeight: { md: 0 },
          display: { xs: "flex", md: "grid" },
          flexDirection: { xs: "column", md: undefined },
          gridTemplateColumns: { md: "360px 1fr" },
          // Desktop: no overflow (children handle their own scroll)
          overflow: { md: "hidden" },
        }}
      >
        {/* Chat */}
        <Box
          sx={{
            // Mobile: fixed 70vh tall, chat scrolls internally
            height: { xs: "70vh", md: "100%" },
            flex: { xs: "0 0 70vh", md: undefined },
            minHeight: { md: 0 },
            overflow: "hidden",
            borderBottom: { xs: "1px solid", md: "none" },
            borderBottomColor: { xs: dashboardTokens.border },
          }}
        >
          <ChatSidebar fullName={profile.full_name} email={profile.email} />
        </Box>

        {/* Runway — on mobile: natural height so page scrolls to reveal it */}
        <Box
          sx={{
            // Mobile: min 80vh so there's plenty to scroll into
            minHeight: { xs: "80vh", md: 0 },
            flex: { xs: "0 0 auto", md: undefined },
            // Desktop: scroll within the panel
            overflow: { xs: "visible", md: "auto" },
            bgcolor: dashboardTokens.surfaceV2,
          }}
        >
          <RunwaySection />
        </Box>
      </Box>
    </Box>
  );
}
