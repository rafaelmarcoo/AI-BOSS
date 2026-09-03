import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { Box } from "@mui/material";
import { COOKIE_ACCESS_TOKEN } from "@/lib/supabase";
import { getCurrentUserProfile } from "@/lib/auth";
import { dashboardTokens } from "@/app/theme";
import { DashboardHeader } from "./header";
import { ResizablePanels } from "./ResizablePanels";

interface DashboardPageProps {
  searchParams?: Promise<{
    conversationId?: string;
    initialMessage?: string;
  }>;
}

function normalizeSearchParam(value: string | undefined) {
  const trimmed = value?.trim();

  return trimmed ? trimmed : null;
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(COOKIE_ACCESS_TOKEN)?.value;
  const params = await searchParams;

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

      <ResizablePanels
        fullName={profile.full_name}
        email={profile.email}
        userType={profile.user_type}
        initialConversationId={normalizeSearchParam(params?.conversationId)}
        initialMessage={normalizeSearchParam(params?.initialMessage)}
      />
    </Box>
  );
}
