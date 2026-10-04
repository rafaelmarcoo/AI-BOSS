import { Box } from '@mui/material'
import { AuthForm } from '@/components/auth-form'
import { authEntryPageStyles } from '@/components/auth-ui'

export default function SignUpPage() {
  return (
    <Box
      component="main"
      sx={authEntryPageStyles}
    >
      <AuthForm
        mode="sign-up"
        showTestBypass={process.env.NODE_ENV !== 'production'}
      />
    </Box>
  )
}
