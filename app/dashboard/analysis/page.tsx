import { Box } from '@mui/material'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { dashboardTokens } from '@/app/theme'
import { DashboardHeader } from '@/app/dashboard/header'
import { getCurrentUserProfile } from '@/lib/auth'
import { COOKIE_ACCESS_TOKEN } from '@/lib/supabase'
import { AnalysisWorkspace } from './AnalysisWorkspace'

export default async function AnalysisPage() {
  const cookieStore = await cookies()
  const accessToken = cookieStore.get(COOKIE_ACCESS_TOKEN)?.value
  if (!accessToken) redirect('/sign-in')

  const currentUser = await getCurrentUserProfile(accessToken).catch(() => null)
  if (!currentUser) redirect('/sign-in')

  return (
    <Box className="analysis-page-shell" component="main" sx={{ minHeight: '100vh', bgcolor: dashboardTokens.shell }}>
      <Box className="analysis-screen-only"><DashboardHeader /></Box>
      <Box sx={{ maxWidth: 1440, mx: 'auto', px: { xs: 2, sm: 4 }, py: { xs: 3, sm: 5 } }}>
        <AnalysisWorkspace />
      </Box>
    </Box>
  )
}
