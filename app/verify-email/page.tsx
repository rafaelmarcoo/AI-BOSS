import { Box } from '@mui/material'
import { authPageStyles } from '@/components/auth-ui'
import { VerifyEmailNotice } from '@/components/verify-email-notice'

export default function VerifyEmailPage() {
  return (
    <Box component="main" sx={authPageStyles}>
      <VerifyEmailNotice />
    </Box>
  )
}
