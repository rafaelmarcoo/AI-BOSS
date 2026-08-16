# lib, api, auth architecture guide

## Lib helpers

- `lib/supabase.ts`: exports scoped Supabase clients (`createBrowserSupabaseClient`, `createServerSupabaseClient`, `createAdminSupabaseClient`) plus the two cookie keys used for sessions. Every route and helper imports the client that matches its runtime/privilege level.  
- `lib/api/errors.ts`: defines `ApiError` and its codes so we can throw structured errors instead of ad-hoc JSON.  
- `lib/api/responses.ts`: wraps every route to return `{ success: boolean, data?, error? }`, exports `successResponse`, `errorResponse`, and `handleRouteError`.  
- `lib/api/validation.ts`: reads JSON from incoming requests and validates sign-in/sign-up payloads with shared constraints; helpers return normalized data or throw `ApiError`.  
- `lib/auth.ts`: contains bearer-token/cookie extraction, `requireAuthenticatedUser`, profile lookup, and helpers to set/clear session cookies in route handlers.

## API surface (`app/api`)

- `app/api/auth/{signup,signin,signout,me}`: validation + auth helpers coordinate Supabase Auth, profile upserts, session cookies, and shared response formatting. Signup creates an unconfirmed account; signin verifies the password and sends an email confirmation link. Neither issues app cookies immediately.  
- `app/api/auth/email/resend`: asks Supabase to resend the signup confirmation link. Supabase verifies the address when the user follows that link.  
- `app/api/auth/email/resend-signin`: resends a login link only while the browser still has the short-lived password-verified cookie.  
- `app/api/auth/magic-link/session`: validates the callback state and Supabase link tokens, then creates the HttpOnly app session cookies.  
- `app/api/health/route.ts`: unprotected health check (returns `{ status: 'ok', timestamp }`).  
- `app/api/xero`, `app/api/chat`, `app/api/calculate`: each handler calls `requireAuthenticatedUser` so they return `401`/`403` when the JWT is missing/invalid, and otherwise emit a stub success payload per the standard response shape.  
- `app/api/test-db/route.ts`: now uses the shared response helpers and admin Supabase client to report user counts.  

## UI & proxy

- `components/auth-form.tsx`: client component used by both `/sign-in` and `/sign-up`; signup continues to `/verify-email`, while password-plus-email signin continues to `/check-email`.  
- `components/verify-email-notice.tsx`: tells new users to follow the confirmation link in their inbox and supports resending it.  
- `components/magic-link-notice.tsx`: tells returning users to follow their sign-in link and supports requesting a replacement.  
- `components/magic-link-callback.tsx`: removes link tokens from the browser URL, exchanges them for HttpOnly cookies, and continues to `/landing`.  
- `components/sign-out-button.tsx`: hits `/api/auth/signout` and clears cookies before returning to `/sign-in`.  
- `app/sign-in/page.tsx` & `app/sign-up/page.tsx`: server components that pass `searchParams?.redirectTo` to `AuthForm`.  
- `app/dashboard/page.tsx`: reads the access-token cookie, fetches `getCurrentUserProfile`, and renders a protected layout plus sign-out button; redirects to `/sign-in` if the token/profile are missing.  
- `app/page.tsx`: dark welcome card that points to the auth flow so the homepage and auth experience feel cohesive.  
- `proxy.ts`: matches `/dashboard` and the auth pages; redirects unauthenticated visitors to `/sign-in` and signed-in users away from the sign-in/up pages.

## Workflow for new work

1. Route handlers should import `successResponse`/`handleRouteError` and the relevant `lib` helpers so errors and validation stay consistent.  
2. UI should rely on the existing forms/components where possible to keep UX/patterns uniform.  
3. Protected calls verify tokens through `requireAuthenticatedUser`; UI routes use `proxy.ts` only for optimistic redirects and still revalidate in the handler.  
