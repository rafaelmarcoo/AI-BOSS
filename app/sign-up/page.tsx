import { Box } from '@mui/material'
import { AuthForm } from '@/components/auth-form'
import { authPageStyles } from '@/components/auth-ui'

export default function SignUpPage() {
  return (
    <Box
      component="main"
      sx={authPageStyles}
    >
      <AuthForm mode="sign-up" />
    </Box>
  )
}
