import { Box } from '@mui/material'
import { authPageStyles } from '@/components/auth-ui'
import { MagicLinkCallback } from '@/components/magic-link-callback'

export default function MagicLinkCallbackPage() {
  return (
    <Box component="main" sx={authPageStyles}>
      <MagicLinkCallback />
    </Box>
  )
}
