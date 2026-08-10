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
      variant="text"
      sx={{
        borderRadius: '999px',
        px: 2.5,
        py: 1.25,
        color: 'common.white',
        textTransform: 'none',
        '&:hover': {
          color: 'common.white',
          backgroundColor: 'transparent',
        },
      }}
    >
      {isSubmitting ? 'Logging out...' : 'Log out'}
    </Button>
  )
}
