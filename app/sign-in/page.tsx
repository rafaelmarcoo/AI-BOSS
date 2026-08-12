import { Box } from '@mui/material'
import { AuthForm } from '@/components/auth-form'
import { authPageStyles } from '@/components/auth-ui'

export default function SignInPage() {
  return (
    <Box
      component="main"
      sx={authPageStyles}
    >
      <AuthForm mode="sign-in" />
    </Box>
  )
}
