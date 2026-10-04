'use client'

import { Button } from '@mui/material'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { dashboardTokens } from '@/app/theme'

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
    <Button
      type="button"
      onClick={handleSignOut}
      disabled={isSubmitting}
      variant="text"
      sx={{
        minHeight: 32,
        minWidth: 0,
        borderRadius: `${dashboardTokens.radiusSm}px`,
        px: 1.25,
        color: dashboardTokens.textMuted,
        fontSize: 13,
        textTransform: 'none',
        '&:hover': {
          color: dashboardTokens.text,
          backgroundColor: 'rgba(255,255,255,0.08)',
        },
      }}
    >
      {isSubmitting ? 'Logging out...' : 'Log out'}
    </Button>
  )
}
