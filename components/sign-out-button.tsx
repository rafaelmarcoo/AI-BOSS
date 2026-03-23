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
      className="rounded-full border border-white/15 px-5 py-3 text-sm font-medium text-white transition hover:border-cyan-300 hover:text-cyan-200 disabled:cursor-not-allowed disabled:opacity-70"
    >
      {isSubmitting ? 'Logging out...' : 'Log out'}
    </button>
  )
}
