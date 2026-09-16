# Password plus email-confirmation signin

AI-BOSS requires two application-level steps for returning users: a valid account
password followed by a link delivered to the account email. Supabase does not
classify email as a native `aal2` MFA factor, so AI-BOSS enforces this sequence at
its own session boundary.

## Flow

1. `/sign-in` posts the email and password to `/api/auth/signin`.
2. The route verifies the password with Supabase but does not expose or persist that
   initial session.
3. After password success, the route binds the email to a ten-minute HttpOnly cookie
   and asks Supabase to send a login link.
4. `/check-email` tells the user to follow the link. Resending is permitted only
   while the password-verified cookie remains valid.
5. Supabase verifies the link and redirects to `/auth/callback`. Its implicit-flow
   tokens arrive in the URL fragment, which is not sent to the server.
6. The callback removes the fragment from browser history and posts the tokens to
   `/api/auth/magic-link/session`.
7. The server validates the tokens, requires the returned account to match the
   password-verified email cookie, then issues the normal AI-BOSS HttpOnly session
   cookies and continues to `/landing`.

Opening the email link in a different browser will fail because that browser does
not have the short-lived password-verification cookie.

## Required Supabase configuration

In **Authentication → URL Configuration → Redirect URLs**, allow both local and
deployed callback URLs, for example:

- `http://localhost:3000/auth/callback`
- `https://your-domain.example/auth/callback`

In **Authentication → Email Templates → Magic Link**, keep
`{{ .ConfirmationURL }}` in the link target.

The built-in Supabase mailer is limited to two authentication emails per hour for
the entire project. Configure custom SMTP before production use.

References:

- https://supabase.com/docs/guides/auth/auth-email-passwordless
- https://supabase.com/docs/guides/auth/rate-limits

## Smoke test

1. Enter an incorrect password and confirm no email is sent.
2. Enter the correct password and confirm `/check-email` opens.
3. Follow the received link in the same browser and confirm `/landing` opens.
4. Attempt to open the link in another browser and confirm it is rejected.
5. Reuse the same link and confirm it is rejected as expired or already used.
