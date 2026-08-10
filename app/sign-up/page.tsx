import { Box } from '@mui/material'
import { AuthForm } from '@/components/auth-form'

export default function SignUpPage() {
  return (
    <Box
      component="main"
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'radial-gradient(circle_at_top,_rgba(191,219,254,0.65),_rgba(248,250,252,1)_55%)',
        px: 6,
        py: 16,
      }}
    >
      <AuthForm mode="sign-up" />
    </Box>
  )
}
