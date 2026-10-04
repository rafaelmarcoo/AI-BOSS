import { Box } from '@mui/material'
import { AuthForm } from '@/components/auth-form'
import { authEntryPageStyles } from '@/components/auth-ui'

export default function SignInPage() {
  return (
    <Box
      component="main"
      sx={authEntryPageStyles}
    >
      <AuthForm
        mode="sign-in"
        showTestBypass={process.env.NODE_ENV !== 'production'}
      />
    </Box>
  )
}
