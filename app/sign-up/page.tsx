import { AuthForm } from '@/components/auth-form'

interface SignUpPageProps {
  searchParams?: Promise<{
    redirectTo?: string
  }>
}

export default async function SignUpPage({ searchParams }: SignUpPageProps) {
  const params = await searchParams

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(191,219,254,0.65),_rgba(248,250,252,1)_55%)] px-6 py-16">
      <AuthForm mode="sign-up" redirectTo={params?.redirectTo} />
    </main>
  )
}
