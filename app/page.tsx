import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { COOKIE_ACCESS_TOKEN } from '@/lib/supabase'
import { getCurrentUserProfile } from '@/lib/auth'

export default async function Home() {
  const accessToken = (await cookies()).get(COOKIE_ACCESS_TOKEN)?.value

  if (!accessToken) {
    redirect('/sign-in')
  }

  const currentUser = await getCurrentUserProfile(accessToken).catch(() => null)

  if (!currentUser) {
    redirect('/sign-in')
  }

  redirect('/landing')
}
