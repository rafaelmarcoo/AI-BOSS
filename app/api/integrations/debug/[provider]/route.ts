import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase'
import { getValidTokens } from '@/lib/integrations/connections'
import { getAdapter } from '@/lib/integrations/registry'
import type { AccountingProvider } from '@/lib/integrations/types'

function fmt(value: number, currency: string) {
  return new Intl.NumberFormat('en-NZ', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(value)
}

const METRICS = [
  { key: 'cashBalance', label: 'Cash Balance' },
  { key: 'accountsReceivable', label: 'Accounts Receivable' },
  { key: 'accountsPayable', label: 'Accounts Payable' },
  { key: 'monthlyRevenue', label: 'Monthly Revenue' },
  { key: 'monthlyExpenses', label: 'Monthly Expenses' },
] as const

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params

  const url = new URL(request.url)
  const userId = url.searchParams.get('userId')
  if (!userId) {
    return new NextResponse(errorPage('Missing <code>userId</code> query parameter.'), {
      status: 400,
      headers: { 'Content-Type': 'text/html' },
    })
  }

  const supabase = createAdminSupabaseClient()
  const { data: user } = await supabase.auth.admin.getUserById(userId)
  if (!user.user) {
    return new NextResponse(errorPage('User not found.'), {
      status: 404,
      headers: { 'Content-Type': 'text/html' },
    })
  }

  let snapshot
  try {
    const tokens = await getValidTokens(userId, provider as AccountingProvider)
    const adapter = getAdapter(provider)
    snapshot = await adapter.getFinancialSnapshot(tokens)
  } catch (err) {
    return new NextResponse(errorPage(String(err)), {
      status: 500,
      headers: { 'Content-Type': 'text/html' },
    })
  }

  const providerLabel = provider.charAt(0).toUpperCase() + provider.slice(1)

  const metricCards = METRICS.map(({ key, label }) => {
    const value = snapshot[key] as number
    const formatted = fmt(value, snapshot.currency)
    return `
      <div class="card">
        <div class="card-label">${label}</div>
        <div class="card-value">${formatted}</div>
      </div>`
  }).join('')

  const rawJson = JSON.stringify(snapshot.raw, null, 2)

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${providerLabel} · Financial Snapshot</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #0f1117;
      color: #e2e8f0;
      min-height: 100vh;
      padding: 48px 24px;
    }
    .container { max-width: 780px; margin: 0 auto; }
    .header { margin-bottom: 32px; }
    .badge {
      display: inline-block;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #94a3b8;
      background: #1e2433;
      border: 1px solid #2d3748;
      border-radius: 999px;
      padding: 3px 10px;
      margin-bottom: 10px;
    }
    h1 { font-size: 26px; font-weight: 700; color: #f1f5f9; }
    .meta { font-size: 13px; color: #64748b; margin-top: 6px; }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 14px;
      margin-bottom: 40px;
    }
    .card {
      background: #1a1f2e;
      border: 1px solid #2d3748;
      border-radius: 10px;
      padding: 18px 20px;
    }
    .card-label { font-size: 12px; color: #64748b; font-weight: 500; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.06em; }
    .card-value { font-size: 22px; font-weight: 700; color: #f1f5f9; }
    details { background: #1a1f2e; border: 1px solid #2d3748; border-radius: 10px; overflow: hidden; }
    summary {
      padding: 14px 20px;
      font-size: 13px;
      font-weight: 600;
      color: #94a3b8;
      cursor: pointer;
      user-select: none;
      list-style: none;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    summary::before { content: "▶"; font-size: 10px; transition: transform 0.15s; }
    details[open] summary::before { transform: rotate(90deg); }
    pre {
      padding: 20px;
      font-size: 12px;
      line-height: 1.6;
      color: #94a3b8;
      overflow-x: auto;
      border-top: 1px solid #2d3748;
      white-space: pre-wrap;
      word-break: break-all;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="badge">Debug · Live fetch</div>
      <h1>${providerLabel} Financial Snapshot</h1>
      <div class="meta">As of ${snapshot.asOf} · Currency: ${snapshot.currency}</div>
    </div>
    <div class="grid">${metricCards}</div>
    <details>
      <summary>Raw API response</summary>
      <pre>${rawJson.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
    </details>
  </div>
</body>
</html>`

  return new NextResponse(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html' },
  })
}

function errorPage(message: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Debug Error</title>
  <style>
    body { font-family: -apple-system, sans-serif; background: #0f1117; color: #e2e8f0; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
    .box { background: #1a1f2e; border: 1px solid #ef4444; border-radius: 10px; padding: 32px 40px; max-width: 480px; }
    h2 { color: #ef4444; font-size: 18px; margin-bottom: 12px; }
    p { color: #94a3b8; font-size: 14px; line-height: 1.6; }
    code { font-family: monospace; background: #0f1117; padding: 2px 6px; border-radius: 4px; }
  </style>
</head>
<body>
  <div class="box">
    <h2>Error</h2>
    <p>${message}</p>
  </div>
</body>
</html>`
}
