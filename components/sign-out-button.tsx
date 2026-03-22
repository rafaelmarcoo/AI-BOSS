'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export function SignOutButton() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSignOut() {
    setIsSubmitting(true)
    await fetch('/api/auth/signout', {
      method: 'POST',
      credentials: 'include',
    })
    router.push('/sign-in')
    router.refresh()
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={isSubmitting}
      className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-950 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-70"
    >
      {isSubmitting ? 'Signing out...' : 'Sign out'}
    </button>
  )
}
