'use client'

import NextLink from 'next/link'
import { useRouter } from 'next/navigation'
import { FormEvent, useEffect, useState } from 'react'
import {
  Alert,
  Button,
  FormControl,
  FormHelperText,
  FormLabel,
  Link as MuiLink,
  MenuItem,
  Paper,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'
import type { UserType } from '@/types/database'
import { authCardStyles, authFieldStyles } from '@/components/auth-ui'

type Mode = 'sign-in' | 'sign-up'

interface AuthFormProps {
  mode: Mode
}

interface ApiErrorPayload {
  success: false
  error?: {
    message?: string
    details?: Record<string, string>
  }
}

interface CompaniesPayload {
  success: true
  data: { companies: string[] }
}

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [userType, setUserType] = useState<UserType | null>(null)
  const [companies, setCompanies] = useState<string[]>([])
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(false)
  const [companiesError, setCompaniesError] = useState<string | null>(null)

  useEffect(() => {
    if (mode !== 'sign-up' || userType !== 'employee') return

    const controller = new AbortController()

    async function loadCompanies() {
      setIsLoadingCompanies(true)
      setCompaniesError(null)

      try {
        const response = await fetch('/api/auth/companies', {
          credentials: 'include',
          signal: controller.signal,
        })
        const payload = (await response.json().catch(() => null)) as
          | CompaniesPayload
          | null

        if (!response.ok || !payload?.success) {
          throw new Error('Unable to load companies.')
        }

        setCompanies(payload.data.companies)
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setCompaniesError('Companies could not be loaded. Please try again.')
      } finally {
        if (!controller.signal.aborted) setIsLoadingCompanies(false)
      }
    }

    void loadCompanies()
    return () => controller.abort()
  }, [mode, userType])

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
            userType: userType ?? '',
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

    router.replace('/landing')
    router.refresh()
  }

  const isSignUp = mode === 'sign-up'

  return (
    <Paper
      component="form"
      onSubmit={handleSubmit}
      elevation={0}
      sx={authCardStyles}
    >
      <Stack spacing={3}>
        <Stack spacing={0.5}>
          <Typography variant="overline" sx={{ color: "#93c5fd" }} fontWeight={700}>
            AI-BOSS financial intelligence
          </Typography>
          <Typography variant="h4" component="h1" fontWeight={600} color="common.white">
          {isSignUp ? 'Create your workspace account' : 'Welcome back'}
          </Typography>
          <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.68)" }}>
          {isSignUp
            ? 'Set up a secure account for clear, source-aware financial decisions.'
            : 'Sign in to your AI-BOSS financial intelligence workspace.'}
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
              sx={authFieldStyles}
            />

            <FormControl error={Boolean(fieldErrors.userType)}>
              <FormLabel id="user-type-label" sx={{ color: "rgba(255,255,255,0.76)" }}>How will you use AI-BOSS?</FormLabel>
              <ToggleButtonGroup
                aria-labelledby="user-type-label"
                value={userType}
                exclusive
                fullWidth
                onChange={(_, nextUserType: UserType | null) => {
                  if (nextUserType) setUserType(nextUserType)
                }}
                sx={{ mt: 1, "& .MuiToggleButton-root": { color: "rgba(255,255,255,0.72)", borderColor: "rgba(255,255,255,0.16)" }, "& .Mui-selected": { color: "common.white !important", bgcolor: "rgba(59,130,246,0.26) !important" } }}
              >
                <ToggleButton value="admin">Create a company</ToggleButton>
                <ToggleButton value="employee">Join a company</ToggleButton>
              </ToggleButtonGroup>
              <FormHelperText>{fieldErrors.userType ?? ' '}</FormHelperText>
            </FormControl>

            {userType === 'admin' ? (
              <TextField
                name="companyName"
                label="Company name"
                type="text"
                placeholder="Acme Ltd"
                autoComplete="organization"
                fullWidth
                required
                error={Boolean(fieldErrors.companyName)}
                helperText={
                  fieldErrors.companyName ?? 'This creates a company employees can join.'
                }
                sx={authFieldStyles}
              />
            ) : null}

            {userType === 'employee' ? (
              <Stack spacing={1}>
                {companiesError ? <Alert severity="error">{companiesError}</Alert> : null}
                {!isLoadingCompanies && !companiesError && companies.length === 0 ? (
                  <Alert severity="info">
                    No companies are available yet. An admin must create one first.
                  </Alert>
                ) : null}
                <TextField
                  name="companyName"
                  label="Company"
                  select
                  defaultValue=""
                  fullWidth
                  required
                  disabled={isLoadingCompanies || Boolean(companiesError)}
                  error={Boolean(fieldErrors.companyName)}
                  helperText={
                    fieldErrors.companyName ??
                    (isLoadingCompanies ? 'Loading companies...' : 'Choose the company you work for.')
                  }
                  sx={authFieldStyles}
                >
                  {companies.map((companyName) => (
                    <MenuItem key={companyName} value={companyName}>
                      {companyName}
                    </MenuItem>
                  ))}
                </TextField>
              </Stack>
            ) : null}
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
          sx={authFieldStyles}
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
          sx={authFieldStyles}
        />

        {!isSignUp ? (
          <MuiLink component={NextLink} href="/forgot-password" underline="hover" sx={{ alignSelf: "flex-end", fontSize: 14, color: "#bfdbfe" }}>
            Forgot password?
          </MuiLink>
        ) : null}

        <Button
          type="submit"
          variant="contained"
          disabled={
            isSubmitting ||
            (isSignUp && (!userType || isLoadingCompanies || Boolean(companiesError)))
          }
          fullWidth
          sx={{ py: 1.5, borderRadius: '999px', bgcolor: '#2563eb', '&:hover': { bgcolor: '#1d4ed8' } }}
        >
          {isSubmitting
            ? 'Working...'
            : isSignUp
              ? 'Create account'
              : 'Sign in'}
        </Button>

        <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.68)" }}>
          {isSignUp ? 'Already have an account?' : 'Need an account?'}{' '}
          <MuiLink
            component={NextLink}
            href={isSignUp ? '/sign-in' : '/sign-up'}
            underline="hover"
            sx={{ fontWeight: 600, color: '#bfdbfe' }}
          >
            {isSignUp ? 'Sign in' : 'Sign up'}
          </MuiLink>
        </Typography>
      </Stack>
    </Paper>
  )
}
