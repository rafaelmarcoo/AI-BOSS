import Link from 'next/link'
import { cookies } from 'next/headers'
import { COOKIE_ACCESS_TOKEN } from '@/lib/supabase'
import { getCurrentUserProfile } from '@/lib/auth'

export default async function Home() {
  const accessToken = (await cookies()).get(COOKIE_ACCESS_TOKEN)?.value
  const signedInProfile = accessToken
    ? await getCurrentUserProfile(accessToken).catch(() => null)
    : null

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,_#f8fafc_0%,_#dbeafe_45%,_#eff6ff_100%)] px-6 py-12 text-slate-950">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10">
        <section className="rounded-[2.25rem] border border-slate-200/80 bg-white/80 p-8 shadow-[0_32px_120px_rgba(15,23,42,0.14)] backdrop-blur md:p-12">
          <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
            <div className="max-w-3xl space-y-5">
              <p className="text-sm uppercase tracking-[0.26em] text-sky-700">
                AI-BOSS card 3
              </p>
              <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
                API routes, auth flow, and protected scaffolding are ready to test.
              </h1>
              <p className="max-w-2xl text-base leading-8 text-slate-600">
                This foundation wires Supabase Auth into Next.js 16 route handlers,
                standardizes API responses, and protects future Xero, chat, and
                calculation endpoints behind verified JWTs.
              </p>
            </div>

            <div className="min-w-[260px] rounded-[1.75rem] border border-slate-200 bg-slate-950 p-6 text-slate-50">
              <p className="text-sm text-cyan-200">Current status</p>
              <p className="mt-3 text-2xl font-semibold">
                {signedInProfile?.profile.email ?? 'Signed out'}
              </p>
              <p className="mt-2 text-sm text-slate-300">
                {signedInProfile
                  ? 'A valid session cookie is present for protected page access.'
                  : 'Sign in to test the protected dashboard and auth endpoints.'}
              </p>
            </div>
          </div>
        </section>

        <section className="grid gap-6 md:grid-cols-[1.3fr_0.7fr]">
          <div className="rounded-[2rem] border border-slate-200 bg-white/75 p-8">
            <h2 className="text-2xl font-semibold">What you can test now</h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {[
                'POST /api/auth/signup',
                'POST /api/auth/signin',
                'POST /api/auth/signout',
                'GET /api/auth/me',
                'GET /api/health',
                'Protected JWT checks on /api/xero, /api/chat, /api/calculate',
              ].map((item) => (
                <div
                  key={item}
                  className="rounded-[1.5rem] border border-slate-200 bg-slate-50 px-5 py-4 text-sm text-slate-700"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[2rem] border border-slate-200 bg-white/75 p-8">
            <h2 className="text-2xl font-semibold">Next step</h2>
            <div className="mt-6 flex flex-col gap-3 text-sm">
              <Link
                href={signedInProfile ? '/dashboard' : '/sign-in'}
                className="rounded-full bg-slate-950 px-5 py-3 text-center font-medium text-white transition hover:bg-slate-800"
              >
                {signedInProfile ? 'Open dashboard' : 'Sign in'}
              </Link>
              {!signedInProfile ? (
                <Link
                  href="/sign-up"
                  className="rounded-full border border-slate-300 px-5 py-3 text-center font-medium text-slate-700 transition hover:border-slate-950 hover:text-slate-950"
                >
                  Create an account
                </Link>
              ) : null}
              <a
                href="/api/health"
                className="rounded-full border border-slate-300 px-5 py-3 text-center font-medium text-slate-700 transition hover:border-slate-950 hover:text-slate-950"
              >
                Check API health
              </a>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
