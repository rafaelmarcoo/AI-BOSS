import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE_ACCESS_TOKEN } from "@/lib/supabase";
import { getCurrentUserProfile } from "@/lib/auth";
import { LandingPage } from "./LandingPage";

export default async function LandingRoute() {
  const accessToken = (await cookies()).get(COOKIE_ACCESS_TOKEN)?.value;

  if (!accessToken) {
    redirect("/sign-in");
  }

  const currentUser = await getCurrentUserProfile(accessToken).catch(() => null);

  if (!currentUser) {
    redirect("/sign-in");
  }

  return (
    <LandingPage
      fullName={currentUser.profile.full_name}
      email={currentUser.profile.email}
    />
  );
}
