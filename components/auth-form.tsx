'use client'

import NextLink from 'next/link'
import { useRouter } from 'next/navigation'
import { FormEvent, useState } from 'react'
import {
  Alert,
  Button,
  Link as MuiLink,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material'

type Mode = 'sign-in' | 'sign-up'

interface AuthFormProps {
  mode: Mode
  redirectTo?: string
}

interface ApiErrorPayload {
  success: false
  error?: {
    message?: string
    details?: Record<string, string>
  }
}

function getRedirectTarget(redirectTo?: string) {
  return redirectTo && redirectTo.startsWith('/') ? redirectTo : '/dashboard'
}

export function AuthForm({ mode, redirectTo }: AuthFormProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)
    setErrorMessage(null)
    setFieldErrors({})

    const formData = new FormData(event.currentTarget)
    const payload =
      mode === 'sign-up'
        ? {
            email: String(formData.get('email') ?? ''),
            password: String(formData.get('password') ?? ''),
            fullName: String(formData.get('fullName') ?? ''),
            companyName: String(formData.get('companyName') ?? ''),
          }
        : {
            email: String(formData.get('email') ?? ''),
            password: String(formData.get('password') ?? ''),
          }

    const response = await fetch(`/api/auth/${mode === 'sign-up' ? 'signup' : 'signin'}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorPayload = (await response.json().catch(() => null)) as ApiErrorPayload | null
      setErrorMessage(
        errorPayload?.error?.message ?? 'We could not complete that request.'
      )
      setFieldErrors(errorPayload?.error?.details ?? {})
      setIsSubmitting(false)
      return
    }

    router.push(getRedirectTarget(redirectTo))
    router.refresh()
  }

  const isSignUp = mode === 'sign-up'

  return (
    <Paper
      component="form"
      onSubmit={handleSubmit}
      elevation={0}
      sx={{
        width: '100%',
        maxWidth: 448,
        p: { xs: 3, sm: 4 },
        borderRadius: '2rem',
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        boxShadow: '0 24px 80px rgba(15, 23, 42, 0.10)',
      }}
    >
      <Stack spacing={3}>
        <Stack spacing={0.5}>
          <Typography variant="h4" component="h1" fontWeight={600}>
          {isSignUp ? 'Create your account' : 'Welcome back'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
          {isSignUp
            ? 'Set up a secure account to start using AI-BOSS.'
            : 'Sign in to access protected API routes and your dashboard.'}
          </Typography>
        </Stack>

        {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}

        {isSignUp ? (
          <Stack spacing={2}>
            <TextField
              name="fullName"
              label="Full name"
              type="text"
              placeholder="Jane Founder"
              autoComplete="name"
              fullWidth
              error={Boolean(fieldErrors.fullName)}
              helperText={fieldErrors.fullName ?? ' '}
            />

            <TextField
              name="companyName"
              label="Company name"
              type="text"
              placeholder="Acme Ltd"
              autoComplete="organization"
              fullWidth
              error={Boolean(fieldErrors.companyName)}
              helperText={fieldErrors.companyName ?? ' '}
            />
          </Stack>
        ) : null}

        <TextField
          name="email"
          label="Email"
          type="email"
          placeholder="founder@example.com"
          autoComplete="email"
          fullWidth
          required
          error={Boolean(fieldErrors.email)}
          helperText={fieldErrors.email ?? ' '}
        />

        <TextField
          name="password"
          label="Password"
          type="password"
          placeholder="At least 8 characters"
          autoComplete={isSignUp ? 'new-password' : 'current-password'}
          fullWidth
          required
          error={Boolean(fieldErrors.password)}
          helperText={fieldErrors.password ?? ' '}
        />

        <Button
          type="submit"
          variant="contained"
          disabled={isSubmitting}
          fullWidth
          sx={{
            py: 1.5,
            borderRadius: '999px',
          }}
        >
          {isSubmitting
            ? 'Working...'
            : isSignUp
              ? 'Create account'
              : 'Sign in'}
        </Button>

        <Typography variant="body2" color="text.secondary">
          {isSignUp ? 'Already have an account?' : 'Need an account?'}{' '}
          <MuiLink
            component={NextLink}
            href={isSignUp ? '/sign-in' : '/sign-up'}
            underline="hover"
            sx={{ fontWeight: 600, color: 'text.primary' }}
          >
            {isSignUp ? 'Sign in' : 'Sign up'}
          </MuiLink>
        </Typography>
      </Stack>
    </Paper>
  )
}
