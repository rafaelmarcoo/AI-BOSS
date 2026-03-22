'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FormEvent, useState } from 'react'

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
    <form
      onSubmit={handleSubmit}
      className="flex w-full max-w-md flex-col gap-4 rounded-[2rem] border border-black/10 bg-white p-8 shadow-[0_24px_80px_rgba(15,23,42,0.10)]"
    >
      <div className="space-y-1">
        <h1 className="text-3xl font-semibold text-slate-950">
          {isSignUp ? 'Create your account' : 'Welcome back'}
        </h1>
        <p className="text-sm text-slate-600">
          {isSignUp
            ? 'Set up a secure account to start using AI-BOSS.'
            : 'Sign in to access protected API routes and your dashboard.'}
        </p>
      </div>

      {errorMessage ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

      {isSignUp ? (
        <>
          <label className="space-y-1 text-sm text-slate-700">
            <span>Full name</span>
            <input
              name="fullName"
              type="text"
              className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-slate-400"
              placeholder="Jane Founder"
            />
            {fieldErrors.fullName ? (
              <span className="text-xs text-red-600">{fieldErrors.fullName}</span>
            ) : null}
          </label>

          <label className="space-y-1 text-sm text-slate-700">
            <span>Company name</span>
            <input
              name="companyName"
              type="text"
              className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-slate-400"
              placeholder="Acme Ltd"
            />
            {fieldErrors.companyName ? (
              <span className="text-xs text-red-600">{fieldErrors.companyName}</span>
            ) : null}
          </label>
        </>
      ) : null}

      <label className="space-y-1 text-sm text-slate-700">
        <span>Email</span>
        <input
          name="email"
          type="email"
          className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-slate-400"
          placeholder="founder@example.com"
          required
        />
        {fieldErrors.email ? (
          <span className="text-xs text-red-600">{fieldErrors.email}</span>
        ) : null}
      </label>

      <label className="space-y-1 text-sm text-slate-700">
        <span>Password</span>
        <input
          name="password"
          type="password"
          className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-slate-400"
          placeholder="At least 8 characters"
          required
        />
        {fieldErrors.password ? (
          <span className="text-xs text-red-600">{fieldErrors.password}</span>
        ) : null}
      </label>

      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded-full bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isSubmitting
          ? 'Working...'
          : isSignUp
            ? 'Create account'
            : 'Sign in'}
      </button>

      <p className="text-sm text-slate-600">
        {isSignUp ? 'Already have an account?' : 'Need an account?'}{' '}
        <Link
          href={isSignUp ? '/sign-in' : '/sign-up'}
          className="font-medium text-slate-950 underline underline-offset-4"
        >
          {isSignUp ? 'Sign in' : 'Sign up'}
        </Link>
      </p>
    </form>
  )
}
