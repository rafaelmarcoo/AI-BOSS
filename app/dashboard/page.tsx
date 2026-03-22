import Link from 'next/link'
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
    <main className="min-h-screen bg-slate-950 px-6 py-16 text-slate-50">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <div className="flex flex-col gap-4 rounded-[2rem] border border-white/10 bg-white/5 p-8 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <p className="text-sm uppercase tracking-[0.24em] text-cyan-200">
              Protected route
            </p>
            <h1 className="text-4xl font-semibold">
              {profile.full_name ?? profile.email}
            </h1>
            <p className="max-w-2xl text-sm text-slate-300">
              Your session is active. Card 3&apos;s protected API scaffolding is
              now ready for Xero, chat, and calculation features.
            </p>
          </div>
          <SignOutButton />
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {['/api/xero', '/api/chat', '/api/calculate'].map((path) => (
            <div
              key={path}
              className="rounded-[1.5rem] border border-white/10 bg-white/5 p-6"
            >
              <p className="text-sm text-cyan-200">{path}</p>
              <p className="mt-3 text-sm text-slate-300">
                Protected placeholder endpoint that now requires a verified JWT.
              </p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-3 text-sm">
          <Link
            href="/"
            className="rounded-full border border-white/15 px-4 py-2 text-slate-100 transition hover:border-cyan-300 hover:text-cyan-200"
          >
            Back home
          </Link>
          <a
            href="/api/health"
            className="rounded-full border border-white/15 px-4 py-2 text-slate-100 transition hover:border-cyan-300 hover:text-cyan-200"
          >
            Health check
          </a>
        </div>
      </div>
    </main>
  )
}
