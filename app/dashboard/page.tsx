import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { Box } from "@mui/material";
import { COOKIE_ACCESS_TOKEN } from "@/lib/supabase";
import { getCurrentUserProfile } from "@/lib/auth";
import { dashboardTokens } from "@/app/theme";
import { DashboardHeader } from "./header";
import { ResizablePanels } from "./ResizablePanels";
import type { DashboardMetrics } from "./runway";

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(COOKIE_ACCESS_TOKEN)?.value;

  if (!accessToken) redirect("/sign-in");

  const currentUser = await getCurrentUserProfile(accessToken).catch(
    () => null,
  );

  if (!currentUser) redirect("/sign-in");

  const { profile } = currentUser;

  // Fetch metrics from API endpoints
  let metrics: DashboardMetrics = {
    cashBalance: null,
    accountsReceivable: null,
    accountsPayable: null,
    monthlyRevenue: null,
    monthlyExpenses: null,
    burnRate: null,
    runwayMonths: null,
  };

  try {
    // TODO: Call /api/calculate/runway to get runway metrics
    // const runwayRes = await fetch(
    //   `${process.env.NEXT_PUBLIC_APP_URL}/api/calculate/runway`,
    //   {
    //     headers: {
    //       Authorization: `Bearer ${accessToken}`,
    //       "Content-Type": "application/json",
    //     },
    //     body: JSON.stringify({ /* payload */ }),
    //   }
    // );
    // const runwayData = await runwayRes.json();
    // metrics.runwayMonths = runwayData.runway_months;
    // metrics.burnRate = runwayData.burn_rate;

    // TODO: Call /api/xero/bank-summary to get cash/AR/AP data
    // const bankRes = await fetch(
    //   `${process.env.NEXT_PUBLIC_APP_URL}/api/xero/bank-summary`,
    //   {
    //     headers: {
    //       Authorization: `Bearer ${accessToken}`,
    //     },
    //   }
    // );
    // const bankData = await bankRes.json();
    // metrics.cashBalance = bankData.cash_balance;
    // metrics.accountsReceivable = bankData.accounts_receivable;
    // metrics.accountsPayable = bankData.accounts_payable;

    console.log("Dashboard metrics loaded:", metrics);
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

      <ResizablePanels
        fullName={profile.full_name}
        email={profile.email}
        metrics={metrics}
      />
    </Box>
  );
}
