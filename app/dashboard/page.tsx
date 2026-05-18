import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { Box } from "@mui/material";
import { COOKIE_ACCESS_TOKEN } from "@/lib/supabase";
import { getCurrentUserProfile } from "@/lib/auth";
import { dashboardTokens } from "@/app/theme";
import {
  fillUnavailableMetrics,
  type CompleteFinancialMetricSet,
} from "@/lib/financial-data";
import { readSourceAwareMetrics } from "@/lib/financial-data/read-service";
import { DashboardHeader } from "./header";
import { ResizablePanels } from "./ResizablePanels";
import { SyncWatcher } from "@/components/sync-watcher";
//import { SyncWatcher } from "@/components/sync-watcher";

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(COOKIE_ACCESS_TOKEN)?.value;

  if (!accessToken) redirect("/sign-in");

  const currentUser = await getCurrentUserProfile(accessToken).catch(
    () => null,
  );

  if (!currentUser) redirect("/sign-in");

  const { profile } = currentUser;

  let metrics: CompleteFinancialMetricSet = fillUnavailableMetrics({});

  try {
    metrics = (await readSourceAwareMetrics(currentUser.user.id)).metrics;
  } catch (error) {
    console.error("Failed to fetch dashboard metrics:", error);
  }

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

      <SyncWatcher />
      <ResizablePanels
        fullName={profile.full_name}
        email={profile.email}
        metrics={metrics}
      />
    </Box>
  );
}
