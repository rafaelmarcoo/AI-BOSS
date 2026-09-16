'use client'

import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { Alert, Button, Paper, Stack, Typography } from '@mui/material'
import { dashboardTokens } from '@/app/theme'

interface CompanyJoinCodeCardProps {
  code: string
  expiresAt: string
}

function formatTimeRemaining(expiresAt: string, now: number) {
  const remainingMs = Math.max(0, new Date(expiresAt).getTime() - now)
  if (remainingMs === 0) return 'Rotating now…'

  const totalMinutes = Math.ceil(remainingMs / 60_000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  return hours > 0 ? `${hours}h ${minutes}m remaining` : `${minutes}m remaining`
}

export function CompanyJoinCodeCard({ code, expiresAt }: CompanyJoinCodeCardProps) {
  const { refresh } = useRouter()
  const [now, setNow] = useState<number | null>(null)
  const [copyStatus, setCopyStatus] = useState<'copied' | 'error' | null>(null)
  const timeRemaining = useMemo(
    () => (now === null ? 'Calculating expiry…' : formatTimeRemaining(expiresAt, now)),
    [expiresAt, now]
  )

  useEffect(() => {
    const initialUpdate = window.setTimeout(() => setNow(Date.now()), 0)
    const interval = window.setInterval(() => setNow(Date.now()), 60_000)
    const refreshDelay = Math.max(
      0,
      new Date(expiresAt).getTime() - Date.now() + 2_000
    )
    const refreshTimer = window.setTimeout(() => refresh(), refreshDelay)

    return () => {
      window.clearTimeout(initialUpdate)
      window.clearInterval(interval)
      window.clearTimeout(refreshTimer)
    }
  }, [expiresAt, refresh])

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code)
      setCopyStatus('copied')
    } catch {
      setCopyStatus('error')
    }
  }

  return (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 2, sm: 3 },
        bgcolor: 'rgba(255,255,255,0.03)',
        border: '1px solid',
        borderColor: dashboardTokens.border,
        color: 'common.white',
      }}
    >
      <Stack spacing={2}>
        <Stack spacing={0.4}>
          <Typography variant="h6" fontWeight={700}>
            Employee join code
          </Typography>
          <Typography variant="body2" sx={{ color: dashboardTokens.textMuted }}>
            Share this code with employees you want to invite. It changes every day
            at midnight UTC.
          </Typography>
        </Stack>

        {copyStatus === 'copied' ? (
          <Alert severity="success">Company code copied.</Alert>
        ) : null}
        {copyStatus === 'error' ? (
          <Alert severity="error">Could not copy the code. Select it manually.</Alert>
        ) : null}

        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1.5}
          alignItems={{ sm: 'center' }}
          justifyContent="space-between"
          sx={{
            p: 2,
            borderRadius: `${dashboardTokens.radiusMd}px`,
            bgcolor: dashboardTokens.surfaceAlt,
            border: '1px solid',
            borderColor: dashboardTokens.borderInput,
          }}
        >
          <Stack spacing={0.5}>
            <Typography
              component="code"
              sx={{
                color: dashboardTokens.text,
                fontFamily: 'monospace',
                fontSize: { xs: 20, sm: 24 },
                fontWeight: 700,
                letterSpacing: '0.08em',
              }}
            >
              {code}
            </Typography>
            <Typography variant="caption" sx={{ color: dashboardTokens.textMuted }}>
              {timeRemaining}
            </Typography>
          </Stack>
          <Button
            type="button"
            variant="outlined"
            startIcon={<ContentCopyRoundedIcon />}
            onClick={copyCode}
            sx={{
              borderColor: dashboardTokens.borderInput,
              color: dashboardTokens.text,
              textTransform: 'none',
            }}
          >
            Copy code
          </Button>
        </Stack>
      </Stack>
    </Paper>
  )
}
