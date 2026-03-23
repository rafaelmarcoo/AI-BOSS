import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { Box, Container, Paper, Stack, Typography } from '@mui/material'
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
    <Box
      component="main"
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        py: 6,
        bgcolor: 'background.default',
      }}
    >
      <Container maxWidth="md">
        <Paper
          elevation={0}
          sx={{
            p: { xs: 4, sm: 6 },
            borderRadius: 6,
            textAlign: 'center',
            bgcolor: '#0f172a',
            color: 'common.white',
            border: '1px solid',
            borderColor: 'rgba(255,255,255,0.08)',
          }}
        >
          <Stack spacing={3} alignItems="center">
            <Typography variant="h3" component="h1" fontWeight={600}>
              Welcome, {profile.full_name ?? profile.email}, to AI-BOSS
            </Typography>
            <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.72)', maxWidth: 560 }}>
              Your workspace is ready. From here, you can sign out or keep building the AI-powered financial tools for your team.
            </Typography>
            <SignOutButton />
          </Stack>
        </Paper>
      </Container>
    </Box>
  )
}
