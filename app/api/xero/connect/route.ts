import { NextRequest, NextResponse } from 'next/server'
import { handleRouteError } from '@/lib/api/responses'
import { requireAuthenticatedUser } from '@/lib/auth'
//import { createServerSupabaseClient } from '@/lib/supabase'
import { createAdminSupabaseClient } from '@/lib/supabase'

// createServerSupabaseClient is commented out because it relies on auth.uid()
// being set, which doesn't work with your team's token-based auth system.
// We use createAdminSupabaseClient instead which bypasses RLS.
// Security is enforced manually via requireAuthenticatedUser() above.

// These are set in .env.local locally and in Vercel environment variables in production
const XERO_CLIENT_ID = process.env.XERO_CLIENT_ID!
const XERO_REDIRECT_URI = process.env.XERO_REDIRECT_URI!

// accounting.settings.read = needed to fetch the list of connected organisations (tenants)
// accounting.contacts.read = needed to read customer and supplier names on invoices
// accounting.invoices.read = needed to fetch AR invoices and AP bills
// accounting.reports.profitandloss.read = needed for P&L report data
// accounting.reports.balancesheet.read = needed for balance sheet data
// accounting.banktransactions.read = needed to read bank transaction data
const XERO_SCOPES = [
  'openid',
  'profile',
  'email',
  'offline_access',
  'accounting.settings.read',
  'accounting.contacts.read',
  'accounting.invoices.read',
  'accounting.reports.profitandloss.read',
  'accounting.reports.balancesheet.read',
  'accounting.banktransactions.read',
].join(' ')

// When the user clicks "Connect to Xero", the browser navigates to this route
export async function GET(request: NextRequest) {
  try {
    const { user } = await requireAuthenticatedUser(request)

    // Generate a random UUID to use as the CSRF state value
    const state = crypto.randomUUID()
    const supabase = createAdminSupabaseClient()

    // upsert = insert if no row exists for this user, update if one already does
    const {} = await supabase
       .from('xero_oauth_states')
       .upsert(
         { user_id: user.id, state, created_at: new Date().toISOString() },
         { onConflict: 'user_id' } // if user already has a state row, replace it
    )

    // Build the Xero authorization URL with all required parameters
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: XERO_CLIENT_ID,
      redirect_uri: XERO_REDIRECT_URI,
      scope: XERO_SCOPES,
      state,
    })

    // Redirect the user to Xero's login and consent page
    return NextResponse.redirect(
      `https://login.xero.com/identity/connect/authorize?${params.toString()}`
    )
  } catch (error) {
    return handleRouteError(error)
  }
}