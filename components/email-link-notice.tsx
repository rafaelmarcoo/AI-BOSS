'use client'

import NextLink from 'next/link'
import { useState, useSyncExternalStore } from 'react'
import {
  Alert,
  Button,
  Link as MuiLink,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { dashboardTokens } from '@/app/theme'
import { authCardStyles, authFieldStyles } from '@/components/auth-ui'

interface ApiErrorPayload {
  success: false
  error?: { message?: string; details?: Record<string, string> }
}

interface EmailLinkNoticeProps {
  storageKey: string
  heading: string
  description: string
  helperText: string
  resendUrl: string
  resendLabel: string
  resendingLabel: string
  fallbackSuccessMessage: string
  primaryLabel?: string
  secondaryPrompt: string
  secondaryHref: string
  secondaryLabel: string
}

function subscribeToPendingEmail() {
  return () => undefined
}

export function EmailLinkNotice({
  storageKey,
  heading,
  description,
  helperText,
  resendUrl,
  resendLabel,
  resendingLabel,
  fallbackSuccessMessage,
  primaryLabel,
  secondaryPrompt,
  secondaryHref,
  secondaryLabel,
}: EmailLinkNoticeProps) {
  const storedEmail = useSyncExternalStore(
    subscribeToPendingEmail,
    () => window.sessionStorage.getItem(storageKey) ?? '',
    () => ''
  )
  const [editedEmail, setEditedEmail] = useState<string | null>(null)
  const [isResending, setIsResending] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [fieldError, setFieldError] = useState<string | null>(null)
  const email = editedEmail ?? storedEmail

  async function handleResend() {
    setIsResending(true)
    setErrorMessage(null)
    setSuccessMessage(null)
    setFieldError(null)

    const response = await fetch(resendUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email }),
    })
    const payload = (await response.json().catch(() => null)) as
      | { success: true; message?: string }
      | ApiErrorPayload
      | null

    if (!response.ok || !payload?.success) {
      const errorPayload = payload as ApiErrorPayload | null
      setErrorMessage(
        errorPayload?.error?.message ?? 'Unable to resend the email link.'
      )
      setFieldError(errorPayload?.error?.details?.email ?? null)
    } else {
      setSuccessMessage(payload.message ?? fallbackSuccessMessage)
    }

    setIsResending(false)
  }

  return (
    <Paper elevation={0} sx={authCardStyles}>
      <Stack spacing={2.5}>
        <Stack spacing={0.25}>
          <Typography sx={{ color: dashboardTokens.text, fontSize: 22, fontWeight: 650 }}>
            AI-BOSS
          </Typography>
          <Typography sx={{ color: dashboardTokens.textSubtle, fontSize: 13 }}>
            Financial intelligence for SME teams
          </Typography>
        </Stack>

        <Stack spacing={0.75}>
          <Typography
            component="h1"
            sx={{ color: dashboardTokens.text, fontSize: 34, fontWeight: 600, letterSpacing: '-0.03em' }}
          >
            {heading}
          </Typography>
          <Typography sx={{ color: dashboardTokens.textMuted, fontSize: 15 }}>
            {description}
          </Typography>
        </Stack>

        {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}
        {successMessage ? <Alert severity="success">{successMessage}</Alert> : null}

        <TextField
          label="Email"
          type="email"
          value={email}
          onChange={(event) => setEditedEmail(event.target.value)}
          autoComplete="email"
          required
          fullWidth
          error={Boolean(fieldError)}
          helperText={fieldError ?? helperText}
          sx={authFieldStyles}
        />

        <Button
          type="button"
          variant="outlined"
          disabled={isResending || !email.trim()}
          onClick={handleResend}
          fullWidth
          sx={{
            minHeight: 48,
            borderRadius: `${dashboardTokens.radiusMd}px`,
            borderColor: dashboardTokens.borderInput,
            color: dashboardTokens.text,
            textTransform: 'none',
          }}
        >
          {isResending ? resendingLabel : resendLabel}
        </Button>

        {primaryLabel ? (
          <Button
            component={NextLink}
            href="/sign-in"
            variant="contained"
            fullWidth
            sx={{
              minHeight: 50,
              borderRadius: `${dashboardTokens.radiusMd}px`,
              bgcolor: dashboardTokens.accent,
              fontSize: 15,
              fontWeight: 600,
              textTransform: 'none',
              boxShadow: 'none',
            }}
          >
            {primaryLabel}
          </Button>
        ) : null}

        <Typography sx={{ color: dashboardTokens.textMuted, fontSize: 14 }}>
          {secondaryPrompt}{' '}
          <MuiLink
            component={NextLink}
            href={secondaryHref}
            underline="hover"
            sx={{ color: dashboardTokens.accentHover, fontWeight: 600 }}
          >
            {secondaryLabel}
          </MuiLink>
        </Typography>
      </Stack>
    </Paper>
  )
}
