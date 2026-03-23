'use client'

import { Button } from '@mui/material'
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
    <Button
      type="button"
      onClick={handleSignOut}
      disabled={isSubmitting}
      variant="outlined"
      sx={{
        borderRadius: '999px',
        px: 2.5,
        py: 1.25,
        borderColor: 'rgba(255, 255, 255, 0.2)',
        color: 'common.white',
        '&:hover': {
          borderColor: 'primary.light',
          color: 'primary.light',
          backgroundColor: 'rgba(255, 255, 255, 0.04)',
        },
      }}
    >
      {isSubmitting ? 'Logging out...' : 'Log out'}
    </Button>
  )
}
