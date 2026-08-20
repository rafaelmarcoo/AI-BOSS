'use client'

import NextLink from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Alert, CircularProgress, Link as MuiLink, Paper, Stack, Typography } from '@mui/material'
import { dashboardTokens } from '@/app/theme'
import { authCardStyles } from '@/components/auth-ui'

export function MagicLinkCallback() {
  const router = useRouter()
  const started = useRef(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (started.current) return
    started.current = true

    async function completeSignIn() {
      const hash = new URLSearchParams(window.location.hash.slice(1))
      const accessToken = hash.get('access_token')
      const refreshToken = hash.get('refresh_token')
      const query = new URLSearchParams(window.location.search)
      const flow = query.get('flow')
      const providerError = hash.get('error_description') ?? query.get('error_description')

      window.history.replaceState({}, document.title, window.location.pathname)

      if (
        providerError ||
        !accessToken ||
        !refreshToken ||
        (flow !== 'signin' && flow !== 'signup')
      ) {
        setErrorMessage(providerError ?? 'This sign-in link is invalid or expired.')
        return
      }

      const response = await fetch('/api/auth/magic-link/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ accessToken, refreshToken, flow }),
      })
      const payload = (await response.json().catch(() => null)) as
        | { success: true }
        | { success: false; error?: { message?: string } }
        | null

      if (!response.ok || !payload?.success) {
        setErrorMessage(
          payload && !payload.success
            ? payload.error?.message ?? 'Unable to complete sign in.'
            : 'Unable to complete sign in.'
        )
        return
      }

      window.sessionStorage.removeItem('pending-signin-email')
      window.sessionStorage.removeItem('pending-signup-email')
      router.replace('/landing')
      router.refresh()
    }

    void completeSignIn()
  }, [router])

  return (
    <Paper elevation={0} sx={authCardStyles}>
      <Stack spacing={2.5} alignItems="center" sx={{ textAlign: 'center' }}>
        <Typography sx={{ color: dashboardTokens.text, fontSize: 22, fontWeight: 650 }}>
          AI-BOSS
        </Typography>
        {errorMessage ? (
          <>
            <Alert severity="error" sx={{ width: '100%' }}>
              {errorMessage}
            </Alert>
            <MuiLink component={NextLink} href="/sign-in" sx={{ color: dashboardTokens.accentHover }}>
              Request a new sign-in link
            </MuiLink>
          </>
        ) : (
          <>
            <CircularProgress size={32} />
            <Typography sx={{ color: dashboardTokens.textMuted }}>
              Completing secure sign in...
            </Typography>
          </>
        )}
      </Stack>
    </Paper>
  )
}
