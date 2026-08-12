# Password recovery and change-password setup

AI-BOSS uses Supabase Auth recovery emails for users who cannot sign in. The app sends recovery links to `/reset-password` and always shows the same response, whether or not the email belongs to an account.

Before deploying, add both of these URLs in **Supabase Dashboard → Authentication → URL Configuration → Redirect URLs**:

- `http://localhost:3000/reset-password`
- `https://<your-deployed-domain>/reset-password`

Set the deployed site as Supabase’s **Site URL** too. The recovery endpoint derives the redirect URL from the request origin, so the URL used in the browser must exactly be allow-listed by Supabase.

Signed-in users can change a password at `/dashboard/settings`. The API verifies their current password server-side, updates the account using the service role only on the server, clears AI-BOSS session cookies, and requires a fresh sign-in.
