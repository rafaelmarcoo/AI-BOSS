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
        minHeight: 32,
        minWidth: 0,
        borderRadius: '8px',
        px: 1.25,
        color: '#9DA7B5',
        fontSize: 13,
        textTransform: 'none',
        '&:hover': {
          color: '#F4F6F8',
          backgroundColor: '#151A24',
        },
      }}
    >
      {isSubmitting ? 'Logging out...' : 'Log out'}
    </Button>
  )
}
