'use client'

import { EmailLinkNotice } from '@/components/email-link-notice'

export function MagicLinkNotice() {
  return (
    <EmailLinkNotice
      storageKey="pending-signin-email"
      heading="Check your email"
      description="We sent you a secure sign-in link. Open the email and click the link to continue to AI-BOSS."
      helperText="Check this inbox and its spam folder."
      resendUrl="/api/auth/email/resend-signin"
      resendLabel="Resend sign-in link"
      resendingLabel="Sending..."
      fallbackSuccessMessage="A new sign-in link has been sent."
      secondaryPrompt="Want to use a different address?"
      secondaryHref="/sign-in"
      secondaryLabel="Return to sign in"
    />
  )
}
