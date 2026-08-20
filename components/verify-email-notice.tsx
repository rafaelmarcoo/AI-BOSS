'use client'

import { EmailLinkNotice } from '@/components/email-link-notice'

export function VerifyEmailNotice() {
  return (
    <EmailLinkNotice
      storageKey="pending-signup-email"
      heading="Check your email"
      description="We sent you a verification link. Open the email and click the link to verify your address and sign in automatically."
      helperText="Check this inbox and its spam folder."
      resendUrl="/api/auth/email/resend"
      resendLabel="Resend verification email"
      resendingLabel="Sending..."
      fallbackSuccessMessage="A new verification email has been sent."
      primaryLabel="Go to sign in"
      secondaryPrompt="Entered the wrong address?"
      secondaryHref="/sign-up"
      secondaryLabel="Start again"
    />
  )
}
