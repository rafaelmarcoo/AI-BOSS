import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { SignOutButton } from '@/components/sign-out-button'
import { COOKIE_ACCESS_TOKEN } from '@/lib/supabase'
import { getCurrentUserProfile } from '@/lib/auth'

export default async function DashboardPage() {
  const cookieStore = await cookies()
  const accessToken = cookieStore.get(COOKIE_ACCESS_TOKEN)?.value

  if (!accessToken) {
    redirect('/sign-in')
  }

  const currentUser = await getCurrentUserProfile(accessToken).catch(() => null)

  if (!currentUser) {
    redirect('/sign-in')
  }

  const { profile } = currentUser

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-white">
      <div className="flex w-full max-w-2xl flex-col items-center gap-8 text-center">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Welcome, {profile.full_name ?? profile.email}, to AI-BOSS
        </h1>
        <SignOutButton />
      </div>
    </main>
  )
}
