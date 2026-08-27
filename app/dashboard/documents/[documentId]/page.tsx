import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Box } from "@mui/material";
import { dashboardTokens } from "@/app/theme";
import { getCurrentUserProfile } from "@/lib/auth";
import { COOKIE_ACCESS_TOKEN } from "@/lib/supabase";
import { DashboardHeader } from "../../header";
import { DocumentReviewWorkspace } from "./DocumentReviewWorkspace";

export default async function DocumentReviewPage({
  params,
}: {
  params: Promise<{ documentId: string }>;
}) {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(COOKIE_ACCESS_TOKEN)?.value;

  if (!accessToken) redirect("/sign-in");

  const currentUser = await getCurrentUserProfile(accessToken).catch(() => null);
  if (!currentUser) redirect("/sign-in");

  const { documentId } = await params;

  return (
    <Box component="main" sx={{ minHeight: "100vh", bgcolor: dashboardTokens.shell }}>
      <DashboardHeader />
      <Box sx={{ maxWidth: 1500, mx: "auto", px: { xs: 1.5, sm: 3 }, py: { xs: 2, sm: 3 } }}>
        <DocumentReviewWorkspace documentId={documentId} />
      </Box>
    </Box>
  );
}
