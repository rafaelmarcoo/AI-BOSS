# Signup email verification

AI-BOSS verifies ownership of each email address once during signup. This is an
email confirmation step, not a second factor on every future login.

## User flow

1. `/sign-up` creates an unconfirmed Supabase Auth user and the AI-BOSS profile.
2. Supabase sends the user a confirmation link.
3. The browser stores only the pending email address in session storage and opens
   `/verify-email`. No authentication tokens are issued yet.
4. The user follows the Supabase confirmation link to verify their address.
5. The user returns to `/sign-in`, enters their password, and confirms the emailed
   login link.

Users can request another link through `/api/auth/email/resend`. Supabase applies
its configured resend cooldown and expiration rules.

## Required Supabase configuration

In the Supabase Dashboard:

1. Open **Authentication → Sign In / Providers → Email** and enable
   **Confirm email**.
2. Open **Authentication → Email Templates → Confirm signup**.
3. Keep `{{ .ConfirmationURL }}` in the template. For example:

```html
<h2>Verify your AI-BOSS email</h2>
<p>Click the link below to finish creating your account:</p>
<p><a href="{{ .ConfirmationURL }}">Verify email address</a></p>
```

The hosted Supabase test mailer is rate limited and best-effort. Configure custom
SMTP before production use.

References:

- https://supabase.com/docs/guides/auth/auth-email-templates
- https://supabase.com/docs/guides/auth/passwords

## Smoke test

1. Sign up with an email address that is not already registered.
2. Confirm that the message contains a verification link.
3. Confirm that `/landing` and authenticated APIs are unavailable before following
   the link.
4. Follow the link and confirm Supabase verifies the email address.
5. Return to `/sign-in`, request a sign-in link, and confirm that following it
   opens `/landing`.
