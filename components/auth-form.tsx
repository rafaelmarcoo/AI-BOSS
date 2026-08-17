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
  IconButton,
  InputAdornment,
  Link as MuiLink,
  MenuItem,
  Paper,
  Stack,
  SvgIcon,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'
import { dashboardTokens } from '@/app/theme'
import type { UserType } from '@/types/database'
import { authCardStyles, authFieldStyles } from '@/components/auth-ui'

type Mode = 'sign-in' | 'sign-up'

interface AuthFormProps {
  mode: Mode
  showTestBypass?: boolean
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

function PasswordVisibilityIcon({ crossed }: { crossed: boolean }) {
  return (
    <SvgIcon fontSize="small" viewBox="0 0 24 24">
      <path
        d="M2.5 12s3.5-5.5 9.5-5.5 9.5 5.5 9.5 5.5-3.5 5.5-9.5 5.5S2.5 12 2.5 12Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx="12"
        cy="12"
        r="2.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      {crossed ? (
        <path
          d="m4 4 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
      ) : null}
    </SvgIcon>
  )
}

export function AuthForm({ mode, showTestBypass = false }: AuthFormProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [userType, setUserType] = useState<UserType | null>(null)
  const [companies, setCompanies] = useState<string[]>([])
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(false)
  const [companiesError, setCompaniesError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

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
    const submitter = (event.nativeEvent as SubmitEvent).submitter as
      | HTMLButtonElement
      | null
    const isTestBypass =
      mode === 'sign-in' && submitter?.value === 'test-bypass'

    setIsSubmitting(true)
    setErrorMessage(null)
    setFieldErrors({})

    const formData = new FormData(event.currentTarget)
    const password = String(formData.get('password') ?? '')
    const email = String(formData.get('email') ?? '')

    if (
      mode === 'sign-up' &&
      password !== String(formData.get('confirmPassword') ?? '')
    ) {
      setFieldErrors({ confirmPassword: 'Passwords do not match.' })
      setIsSubmitting(false)
      return
    }

    const payload =
      mode === 'sign-up'
        ? {
            email,
            password,
            fullName: String(formData.get('fullName') ?? ''),
            companyName: String(formData.get('companyName') ?? ''),
            userType: userType ?? '',
          }
        : {
            email,
            password,
          }

    const endpoint = isTestBypass
      ? '/api/auth/test-bypass'
      : `/api/auth/${mode === 'sign-up' ? 'signup' : 'signin'}`
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(payload),
    })

    const responsePayload = (await response.json().catch(() => null)) as
      | ApiErrorPayload
      | { success: true }
      | null

    if (!response.ok || !responsePayload?.success) {
      const errorPayload = responsePayload as ApiErrorPayload | null
      setErrorMessage(
        errorPayload?.error?.message ?? 'We could not complete that request.'
      )
      setFieldErrors(errorPayload?.error?.details ?? {})
      setIsSubmitting(false)
      return
    }

    if (isTestBypass) {
      window.sessionStorage.removeItem('pending-signin-email')
      router.replace('/landing')
    } else if (mode === 'sign-up') {
      window.sessionStorage.setItem('pending-signup-email', email.trim().toLowerCase())
      router.replace('/verify-email')
    } else {
      window.sessionStorage.setItem('pending-signin-email', email.trim().toLowerCase())
      router.replace('/check-email')
    }
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
      {mode === 'sign-in' && showTestBypass ? (
        <Paper
          elevation={0}
          sx={{
            position: 'fixed',
            top: 20,
            right: 20,
            zIndex: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 1.25,
            p: 1.25,
            border: `1px solid ${dashboardTokens.border}`,
            borderRadius: `${dashboardTokens.radiusMd}px`,
            bgcolor: dashboardTokens.surface,
          }}
        >
          <Typography sx={{ color: dashboardTokens.textMuted, fontSize: 12 }}>
            Development testing only
          </Typography>
          <Button
            type="submit"
            name="intent"
            value="test-bypass"
            variant="outlined"
            disabled={isSubmitting}
            sx={{
              borderColor: dashboardTokens.borderInput,
              color: dashboardTokens.text,
              textTransform: 'none',
            }}
          >
            Bypass email check
          </Button>
        </Paper>
      ) : null}

      <Stack spacing={0}>
        <Stack spacing={0.25}>
          <Typography
            component="p"
            sx={{
              color: dashboardTokens.text,
              fontSize: 22,
              fontWeight: 650,
              letterSpacing: '-0.025em',
            }}
          >
            AI-BOSS
          </Typography>
          <Typography sx={{ color: dashboardTokens.textSubtle, fontSize: 13 }}>
            Financial intelligence for SME teams
          </Typography>
        </Stack>

        <Stack spacing={0.75} sx={{ mt: 3 }}>
          <Typography
            component="h1"
            sx={{
              color: dashboardTokens.text,
              fontSize: { xs: 32, sm: 38 },
              lineHeight: 1.2,
              fontWeight: 600,
              letterSpacing: '-0.03em',
            }}
          >
            {isSignUp ? 'Create your account' : 'Welcome back'}
          </Typography>
          <Typography sx={{ color: dashboardTokens.textMuted, fontSize: 16 }}>
            {isSignUp
              ? 'Get started with your AI-BOSS workspace.'
              : 'Sign in to your workspace.'}
          </Typography>
        </Stack>

        {errorMessage ? (
          <Alert severity="error" sx={{ mt: 2.5 }}>
            {errorMessage}
          </Alert>
        ) : null}

        {isSignUp ? (
          <Stack spacing={2} sx={{ mt: 3 }}>
            <TextField
              name="fullName"
              label="Full name"
              type="text"
              placeholder="Jane Founder"
              autoComplete="name"
              fullWidth
              error={Boolean(fieldErrors.fullName)}
              helperText={fieldErrors.fullName}
              sx={authFieldStyles}
            />

            <FormControl error={Boolean(fieldErrors.userType)}>
              <FormLabel
                id="user-type-label"
                sx={{ color: dashboardTokens.textMuted, fontSize: 13, fontWeight: 500 }}
              >
                How will you use AI-BOSS?
              </FormLabel>
              <ToggleButtonGroup
                aria-labelledby="user-type-label"
                value={userType}
                exclusive
                fullWidth
                onChange={(_, nextUserType: UserType | null) => {
                  if (nextUserType) setUserType(nextUserType)
                }}
                sx={{
                  mt: 1,
                  "& .MuiToggleButton-root": {
                    minHeight: 42,
                    color: dashboardTokens.textMuted,
                    borderColor: dashboardTokens.borderInput,
                    bgcolor: dashboardTokens.surfaceAlt,
                    fontSize: 13,
                    textTransform: 'none',
                  },
                  "& .MuiToggleButton-root:first-of-type": {
                    borderRadius: `${dashboardTokens.radiusSm}px 0 0 ${dashboardTokens.radiusSm}px`,
                  },
                  "& .MuiToggleButton-root:last-of-type": {
                    borderRadius: `0 ${dashboardTokens.radiusSm}px ${dashboardTokens.radiusSm}px 0`,
                  },
                  "& .Mui-selected": {
                    color: `${dashboardTokens.text} !important`,
                    bgcolor: 'rgba(79, 125, 243, 0.16) !important',
                  },
                }}
              >
                <ToggleButton value="admin">Create a company</ToggleButton>
                <ToggleButton value="employee">Join a company</ToggleButton>
              </ToggleButtonGroup>
              {fieldErrors.userType ? (
                <FormHelperText>{fieldErrors.userType}</FormHelperText>
              ) : null}
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
          label={isSignUp ? 'Work email' : 'Email'}
          type="email"
          placeholder="founder@example.com"
          autoComplete="email"
          fullWidth
          required
          error={Boolean(fieldErrors.email)}
          helperText={fieldErrors.email}
          sx={{ ...authFieldStyles, mt: isSignUp ? 2 : 3 }}
        />

        <TextField
          name="password"
          label="Password"
          type={showPassword ? 'text' : 'password'}
          placeholder="At least 8 characters"
          autoComplete={isSignUp ? 'new-password' : 'current-password'}
          fullWidth
          required
          error={Boolean(fieldErrors.password)}
          helperText={
            fieldErrors.password ?? (isSignUp ? 'Use at least 8 characters.' : undefined)
          }
          slotProps={{
            input: {
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    onClick={() => setShowPassword((visible) => !visible)}
                    edge="end"
                    sx={{ color: dashboardTokens.textSubtle }}
                  >
                    <PasswordVisibilityIcon crossed={showPassword} />
                  </IconButton>
                </InputAdornment>
              ),
            },
          }}
          sx={{ ...authFieldStyles, mt: 2 }}
        />

        {isSignUp ? (
          <TextField
            name="confirmPassword"
            label="Confirm password"
            type={showConfirmPassword ? 'text' : 'password'}
            placeholder="Repeat your password"
            autoComplete="new-password"
            fullWidth
            required
            error={Boolean(fieldErrors.confirmPassword)}
            helperText={fieldErrors.confirmPassword}
            slotProps={{
              input: {
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label={
                        showConfirmPassword
                          ? 'Hide confirmed password'
                          : 'Show confirmed password'
                      }
                      onClick={() =>
                        setShowConfirmPassword((visible) => !visible)
                      }
                      edge="end"
                      sx={{ color: dashboardTokens.textSubtle }}
                    >
                      <PasswordVisibilityIcon crossed={showConfirmPassword} />
                    </IconButton>
                  </InputAdornment>
                ),
              },
            }}
            sx={{ ...authFieldStyles, mt: 2 }}
          />
        ) : null}

        {!isSignUp ? (
          <MuiLink
            component={NextLink}
            href="/forgot-password"
            underline="hover"
            sx={{
              mt: 1,
              alignSelf: 'flex-end',
              fontSize: 14,
              color: dashboardTokens.accentHover,
            }}
          >
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
          sx={{
            mt: 2.5,
            minHeight: 50,
            borderRadius: `${dashboardTokens.radiusMd}px`,
            bgcolor: dashboardTokens.accent,
            color: dashboardTokens.text,
            fontSize: 15,
            fontWeight: 600,
            textTransform: 'none',
            boxShadow: 'none',
            '&:hover': {
              bgcolor: dashboardTokens.accentHover,
              boxShadow: 'none',
            },
          }}
        >
          {isSubmitting
            ? 'Working...'
            : isSignUp
              ? 'Create account'
              : 'Continue'}
        </Button>

        <Typography
          sx={{ mt: 2.5, color: dashboardTokens.textMuted, fontSize: 14 }}
        >
          {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
          <MuiLink
            component={NextLink}
            href={isSignUp ? '/sign-in' : '/sign-up'}
            underline="hover"
            sx={{ fontWeight: 600, color: dashboardTokens.accentHover }}
          >
            {isSignUp ? 'Sign in' : 'Sign up'}
          </MuiLink>
        </Typography>
      </Stack>
    </Paper>
  )
}
