import { AuthForm } from '@/components/auth-form'

interface SignInPageProps {
  searchParams?: Promise<{
    redirectTo?: string
  }>
}

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const params = await searchParams

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(226,232,240,0.9),_rgba(248,250,252,1)_55%)] px-6 py-16">
      <AuthForm mode="sign-in" redirectTo={params?.redirectTo} />
    </main>
  )
}
