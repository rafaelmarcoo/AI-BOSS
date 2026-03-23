import { Box } from '@mui/material'
import { AuthForm } from '@/components/auth-form'

interface SignInPageProps {
  searchParams?: Promise<{
    redirectTo?: string
  }>
}

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const params = await searchParams

  return (
    <Box
      component="main"
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'radial-gradient(circle at top, rgba(226,232,240,0.9), rgba(248,250,252,1) 55%)',
        px: 3,
        py: 8,
      }}
    >
      <AuthForm mode="sign-in" redirectTo={params?.redirectTo} />
    </Box>
  )
}
