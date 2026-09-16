import { Box } from '@mui/material'
import { authPageStyles } from '@/components/auth-ui'
import { MagicLinkNotice } from '@/components/magic-link-notice'

export default function CheckEmailPage() {
  return (
    <Box component="main" sx={authPageStyles}>
      <MagicLinkNotice />
    </Box>
  )
}
