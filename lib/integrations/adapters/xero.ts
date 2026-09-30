import crypto from 'node:crypto'
import type {
  AccountingAdapter,
  NormalizedInvoiceRecord,
  NormalizedFinancialData,
  NormalizedReportingPeriodRecord,
  NormalizedStatementLineRecord,
  NormalizedCustomerRecord,
  NormalizedRevenueDimensionRecord,
  NormalizedRevenueEntryRecord,
  OAuthTokens,
  WebhookEvent,
} from '@/lib/integrations/types'

const XERO_AUTH_URL = 'https://login.xero.com/identity/connect/authorize'
const XERO_TOKEN_URL = 'https://identity.xero.com/connect/token'
const XERO_CONNECTIONS_URL = 'https://api.xero.com/connections'
const XERO_API_URL = 'https://api.xero.com/api.xro/2.0'
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

function getCredentials() {
  const clientId = process.env.XERO_CLIENT_ID
  const clientSecret = process.env.XERO_CLIENT_SECRET
  const redirectUri = process.env.XERO_REDIRECT_URI

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('Missing XERO_CLIENT_ID, XERO_CLIENT_SECRET, or XERO_REDIRECT_URI')
  }

  return { clientId, clientSecret, redirectUri }
}

function basicAuthHeader(clientId: string, clientSecret: string) {
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`
}

function parseNumber(value: string | undefined) {
  return parseFloat((value ?? '0').replace(/,/g, '')) || 0
}

function findRowValue(rows: unknown[], title: string): number {
  for (const row of rows) {
    const record = row as Record<string, unknown>
    const cells = record.Cells as Array<{ Value: string }> | undefined

    if (Array.isArray(cells) && cells[0]?.Value === title) {
      return parseNumber(cells[1]?.Value)
    }

    if (record.Title === title && Array.isArray(record.Rows)) {
      const nestedRows = record.Rows as Array<Record<string, unknown>>
      const summary = nestedRows.find((child) => child.RowType === 'SummaryRow')
      const summaryCells = summary?.Cells as Array<{ Value: string }> | undefined
      if (summaryCells) return parseNumber(summaryCells[1]?.Value)
    }

    if (Array.isArray(record.Rows)) {
      const found = findRowValue(record.Rows as unknown[], title)
      if (found !== 0) return found
    }
  }

  return 0
}

type BalanceClassification = Extract<NormalizedStatementLineRecord['classification'],
  | 'current_asset'
  | 'non_current_asset'
  | 'current_liability'
  | 'non_current_liability'
  | 'equity'
  | 'total_assets'
  | 'total_liabilities'
  | 'total_equity'
  | 'other'
>

function balanceClassification(text: string, inherited: BalanceClassification = 'other'): BalanceClassification {
  const normalized = text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
  if (/^total assets?$/.test(normalized)) return 'total_assets'
  if (/^total liabilities?$/.test(normalized)) return 'total_liabilities'
  if (/^total equity$/.test(normalized)) return 'total_equity'
  if (/non current assets?|fixed assets?/.test(normalized)) return 'non_current_asset'
  if (/current assets?/.test(normalized)) return 'current_asset'
  if (/non current liabilities?|long term liabilities?/.test(normalized)) return 'non_current_liability'
  if (/current liabilities?/.test(normalized)) return 'current_liability'
  if (/\bequity\b/.test(normalized)) return 'equity'
  return inherited
}

function quickRatioTreatment(label: string, classification: BalanceClassification): NormalizedStatementLineRecord['quickRatioTreatment'] {
  if (classification !== 'current_asset') return 'not_applicable'
  const normalized = label.toLowerCase()
  if (/bank|cash|accounts? receivable|trade debtors?|marketable securit/.test(normalized)) return 'include'
  if (/inventory|stock on hand|prepaid|prepayment/.test(normalized)) return 'exclude'
  return 'unclassified'
}

function normalizeBalanceSheetRows(rows: unknown[]): NormalizedStatementLineRecord[] {
  const lines: NormalizedStatementLineRecord[] = []
  let sequence = 0

  function visit(items: unknown[], inherited: BalanceClassification, path: string[]) {
    items.forEach((item, itemIndex) => {
      const row = item as Record<string, unknown>
      const title = typeof row.Title === 'string' ? row.Title : ''
      const cells = Array.isArray(row.Cells) ? row.Cells as Array<{ Value?: string; Attributes?: Array<{ Id?: string; Value?: string }> }> : []
      const label = String(cells[0]?.Value ?? title ?? '').trim()
      const classification = balanceClassification(label || title, balanceClassification(title, inherited))
      const nextPath = title ? [...path, title] : path

      if (cells.length >= 2 && label) {
        const rawAmount = cells.slice(1).find((cell) => cell?.Value !== undefined)?.Value
        if (rawAmount !== undefined && rawAmount !== '') {
          const rowType = String(row.RowType ?? '')
          const explicitTotal = /^total\b/i.test(label)
          lines.push({
            lineKey: `balance:${nextPath.join(':')}:${label}:${itemIndex}`.toLowerCase().replace(/[^a-z0-9:]+/g, '-'),
            label,
            classification,
            amount: Math.abs(parseNumber(rawAmount)),
            canonicalCategory: label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''),
            quickRatioTreatment: quickRatioTreatment(label, classification),
            isTotal: rowType === 'SummaryRow' || explicitTotal,
            sortOrder: sequence += 10,
            raw: row,
          })
        }
      }

      if (Array.isArray(row.Rows)) {
        visit(row.Rows, balanceClassification(title, inherited), nextPath)
      }
    })
  }

  visit(rows, 'other', [])
  return lines
}

function normalizeXeroBalanceSheet(
  report: Record<string, unknown> | undefined,
  fallbackDate: string,
  fallbackCurrency: string,
): NormalizedReportingPeriodRecord | null {
  const rows = (report?.Rows as unknown[]) ?? []
  const lines = normalizeBalanceSheetRows(rows)
  if (lines.length === 0) return null
  const reportDate = xeroDate(report?.ReportDate) ?? fallbackDate
  return {
    statementType: 'balance_sheet',
    periodStart: reportDate,
    periodEnd: reportDate,
    currency: String(report?.CurrencyCode ?? fallbackCurrency).toUpperCase(),
    generatedAt: new Date().toISOString(),
    lines,
    raw: report ?? {},
  }
}

function xeroDate(value: unknown): string | null {
  if (typeof value !== 'string' || value.length === 0) return null
  const timestamp = value.match(/^\/Date\((\d+)/)?.[1]
  if (timestamp) return new Date(Number(timestamp)).toISOString().slice(0, 10)
  const parsed = new Date(value)
  return Number.isNaN(parsed.valueOf()) ? null : parsed.toISOString().slice(0, 10)
}

function xeroInvoiceStatus(value: unknown, amountPaid: number, amountDue: number): NormalizedInvoiceRecord['status'] {
  const status = String(value ?? '').toUpperCase()
  if (status === 'PAID') return 'paid'
  if (status === 'VOIDED') return 'voided'
  if (status === 'DELETED') return 'deleted'
  if (status === 'DRAFT') return 'draft'
  if (status === 'SUBMITTED') return 'submitted'
  if (amountPaid > 0 && amountDue > 0) return 'partially_paid'
  return 'authorised'
}

function normalizeXeroInvoice(record: Record<string, unknown>): NormalizedInvoiceRecord | null {
  const providerInvoiceId = String(record.InvoiceID ?? '')
  const issueDate = xeroDate(record.DateString ?? record.Date)
  const dueDate = xeroDate(record.DueDateString ?? record.DueDate)
  const type = String(record.Type ?? '')
  if (!providerInvoiceId || !issueDate || !dueDate || dueDate < issueDate) return null
  if (type !== 'ACCREC' && type !== 'ACCPAY') return null

  const totalAmount = Math.abs(Number(record.Total ?? 0))
  const amountPaid = Math.min(totalAmount, Math.abs(Number(record.AmountPaid ?? 0)))
  const outstandingAmount = Math.min(
    totalAmount,
    Math.max(0, Math.abs(Number(record.AmountDue ?? totalAmount - amountPaid))),
  )
  const currency = String(record.CurrencyCode ?? '').toUpperCase()
  if (!/^[A-Z]{3}$/.test(currency)) return null
  const contact = record.Contact as Record<string, unknown> | undefined
  const lineItems = Array.isArray(record.LineItems) ? record.LineItems as Array<Record<string, unknown>> : []
  const payments = Array.isArray(record.Payments) ? record.Payments as Array<Record<string, unknown>> : []

  return {
    providerInvoiceId,
    invoiceKind: type === 'ACCREC' ? 'sales_invoice' : 'supplier_bill',
    status: xeroInvoiceStatus(record.Status, amountPaid, outstandingAmount),
    invoiceNumber: String(record.InvoiceNumber ?? record.Reference ?? '') || null,
    counterpartyName: String(contact?.Name ?? '') || null,
    issueDate,
    dueDate,
    currency,
    totalAmount,
    amountPaid,
    outstandingAmount,
    fullyPaidAt: record.FullyPaidOnDate ? xeroDate(record.FullyPaidOnDate) : null,
    lines: lineItems.map((line, index) => ({
      lineKey: String(line.LineItemID ?? `${providerInvoiceId}:${index}`),
      providerAccountId: line.AccountID ? String(line.AccountID) : null,
      description: String(line.Description ?? '') || null,
      canonicalCategory: String(line.AccountCode ?? '') || null,
      quantity: line.Quantity === undefined ? null : Number(line.Quantity),
      unitAmount: line.UnitAmount === undefined ? null : Number(line.UnitAmount),
      taxAmount: Math.abs(Number(line.TaxAmount ?? 0)),
      lineAmount: Math.abs(Number(line.LineAmount ?? 0)),
      raw: line,
    })),
    payments: payments.flatMap((payment) => {
      const paymentDate = xeroDate(payment.Date)
      const providerPaymentId = String(payment.PaymentID ?? '')
      if (!paymentDate || !providerPaymentId) return []
      return [{
        providerPaymentId,
        paymentDate,
        status: String(payment.Status ?? '').toUpperCase() === 'DELETED' ? 'deleted' as const : 'posted' as const,
        currency,
        amount: Math.abs(Number(payment.Amount ?? 0)),
        reference: String(payment.Reference ?? '') || null,
        raw: payment,
      }]
    }),
    raw: record,
  }
}

async function fetchXeroInvoices(headers: Record<string, string>) {
  const records: Array<Record<string, unknown>> = []
  for (let page = 1; page <= 10; page += 1) {
    const response = await fetch(`${XERO_API_URL}/Invoices?page=${page}&order=DueDate%20ASC`, {
      signal: AbortSignal.timeout(15_000),
      headers,
    })
    if (!response.ok) return { available: false, invoices: [] as NormalizedInvoiceRecord[] }
    const payload = await response.json() as { Invoices?: Array<Record<string, unknown>> }
    const pageRecords = payload.Invoices ?? []
    records.push(...pageRecords)
    if (pageRecords.length < 100) break
  }
  return {
    available: true,
    invoices: records.flatMap((record) => {
      const invoice = normalizeXeroInvoice(record)
      return invoice ? [invoice] : []
    }),
  }
}

function normalizeXeroRevenueAnalytics(invoices: NormalizedInvoiceRecord[]) {
  const customers = new Map<string, NormalizedCustomerRecord>()
  const dimensions = new Map<string, NormalizedRevenueDimensionRecord>()
  const revenueEntries: NormalizedRevenueEntryRecord[] = []
  for (const invoice of invoices) {
    if (invoice.invoiceKind !== 'sales_invoice') continue
    const revenueStatus: NormalizedRevenueEntryRecord['status'] =
      invoice.status === 'voided' ? 'voided'
        : invoice.status === 'deleted' ? 'deleted'
          : invoice.status === 'draft' || invoice.status === 'submitted' ? 'draft'
            : 'posted'
    const invoiceRaw = invoice.raw as Record<string, unknown> | undefined
    const contact = invoiceRaw?.Contact as Record<string, unknown> | undefined
    const providerCustomerId = String(contact?.ContactID ?? '') || null
    if (providerCustomerId && invoice.counterpartyName) {
      customers.set(providerCustomerId, {
        providerCustomerId,
        name: invoice.counterpartyName,
        status: String(contact?.ContactStatus ?? 'ACTIVE').toUpperCase() === 'ARCHIVED' ? 'inactive' : 'active',
        raw: contact ?? {},
      })
    }

    for (const line of invoice.lines) {
      const raw = line.raw as Record<string, unknown> | undefined
      const entryDimensions: NormalizedRevenueEntryRecord['dimensions'] = []
      const itemCode = String(raw?.ItemCode ?? '').trim()
      if (itemCode) {
        const providerDimensionId = `item:${itemCode}`
        dimensions.set(`product_service\u0000default\u0000${providerDimensionId}`, {
          providerDimensionId,
          dimensionType: 'product_service',
          dimensionGroup: 'default',
          name: line.description || itemCode,
          raw: raw ?? {},
        })
        entryDimensions.push({ providerDimensionId, dimensionType: 'product_service', dimensionGroup: 'default', raw: raw ?? {} })
      }

      const tracking = Array.isArray(raw?.Tracking) ? raw.Tracking as Array<Record<string, unknown>> : []
      for (const tracked of tracking) {
        const optionName = String(tracked.Option ?? '').trim()
        const groupName = String(tracked.Name ?? '').trim()
        if (!optionName || !groupName) continue
        const providerDimensionId = `tracking:${String(tracked.TrackingCategoryID ?? groupName)}:${String(tracked.TrackingOptionID ?? optionName)}`
        dimensions.set(`tracking\u0000${groupName}\u0000${providerDimensionId}`, {
          providerDimensionId,
          dimensionType: 'tracking',
          dimensionGroup: groupName,
          name: optionName,
          raw: tracked,
        })
        entryDimensions.push({ providerDimensionId, dimensionType: 'tracking', dimensionGroup: groupName, raw: tracked })
      }

      revenueEntries.push({
        providerRevenueId: `invoice:${invoice.providerInvoiceId}:line:${line.lineKey}`,
        revenueDate: invoice.issueDate,
        status: revenueStatus,
        currency: invoice.currency,
        amount: line.lineAmount,
        providerCustomerId,
        providerInvoiceId: invoice.providerInvoiceId,
        description: line.description,
        dimensions: entryDimensions,
        raw: raw ?? {},
      })
    }
  }

  return {
    customers: [...customers.values()],
    revenueDimensions: [...dimensions.values()],
    revenueEntries,
  }
}

export class XeroAdapter implements AccountingAdapter {
  readonly provider = 'xero' as const
  readonly label = 'Xero'

  getAuthUrl(state: string) {
    const { clientId, redirectUri } = getCredentials()
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: XERO_SCOPES,
      state,
    })

    return `${XERO_AUTH_URL}?${params.toString()}`
  }

  async exchangeCodeForTokens(code: string): Promise<OAuthTokens> {
    const { clientId, clientSecret, redirectUri } = getCredentials()
    const tokenResponse = await fetch(XERO_TOKEN_URL, {
      method: 'POST',
      signal: AbortSignal.timeout(10_000),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: basicAuthHeader(clientId, clientSecret),
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    })

    if (!tokenResponse.ok) throw new Error(`Xero token exchange failed: ${tokenResponse.status}`)
    const token = (await tokenResponse.json()) as {
      access_token: string
      refresh_token: string
      expires_in: number
    }

    const connectionsResponse = await fetch(XERO_CONNECTIONS_URL, {
      signal: AbortSignal.timeout(10_000),
      headers: { Authorization: `Bearer ${token.access_token}` },
    })

    if (!connectionsResponse.ok) {
      throw new Error(`Xero connections fetch failed: ${connectionsResponse.status}`)
    }

    const connections = (await connectionsResponse.json()) as Array<{
      tenantId: string
      tenantName: string
    }>
    const tenant = connections[0]
    if (!tenant) throw new Error('No Xero tenants connected')

    return {
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      expiresAt: new Date(Date.now() + token.expires_in * 1000),
      tenantId: tenant.tenantId,
      tenantName: tenant.tenantName,
    }
  }

  async refreshAccessToken(refreshToken: string): Promise<OAuthTokens> {
    const { clientId, clientSecret } = getCredentials()
    const response = await fetch(XERO_TOKEN_URL, {
      method: 'POST',
      signal: AbortSignal.timeout(10_000),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: basicAuthHeader(clientId, clientSecret),
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    })

    if (!response.ok) throw new Error(`Xero token refresh failed: ${response.status}`)
    const token = (await response.json()) as {
      access_token: string
      refresh_token?: string
      expires_in: number
    }

    return {
      accessToken: token.access_token,
      refreshToken: token.refresh_token ?? refreshToken,
      expiresAt: new Date(Date.now() + token.expires_in * 1000),
      tenantId: '',
      tenantName: '',
    }
  }

  async getFinancialSnapshot(tokens: OAuthTokens): Promise<NormalizedFinancialData> {
    const headers = {
      Authorization: `Bearer ${tokens.accessToken}`,
      'Xero-Tenant-Id': tokens.tenantId,
      Accept: 'application/json',
    }

    const [balanceSheetResponse, profitLossResponse] = await Promise.all([
      fetch(`${XERO_API_URL}/Reports/BalanceSheet`, {
        signal: AbortSignal.timeout(15_000),
        headers,
      }),
      fetch(`${XERO_API_URL}/Reports/ProfitAndLoss?periods=1&timeframe=MONTH`, {
        signal: AbortSignal.timeout(15_000),
        headers,
      }),
    ])

    if (!balanceSheetResponse.ok) {
      throw new Error(`Xero BalanceSheet failed: ${balanceSheetResponse.status}`)
    }
    if (!profitLossResponse.ok) {
      throw new Error(`Xero ProfitAndLoss failed: ${profitLossResponse.status}`)
    }

    const [balanceSheet, profitLoss] = await Promise.all([
      balanceSheetResponse.json(),
      profitLossResponse.json(),
    ])
    const balanceReport = (balanceSheet as Record<string, unknown[]>).Reports?.[0] as
      | Record<string, unknown>
      | undefined
    const profitLossReport = (profitLoss as Record<string, unknown[]>).Reports?.[0] as
      | Record<string, unknown>
      | undefined

    const balanceRows = (balanceReport?.Rows as unknown[]) ?? []
    const profitLossRows = (profitLossReport?.Rows as unknown[]) ?? []
    const invoiceResult = await fetchXeroInvoices(headers)
    const asOf = new Date().toISOString().slice(0, 10)
    const currency = String(balanceReport?.CurrencyCode ?? 'USD').toUpperCase()
    const normalizedBalanceSheet = normalizeXeroBalanceSheet(balanceReport, asOf, currency)
    const revenueAnalytics = normalizeXeroRevenueAnalytics(invoiceResult.invoices)
    const capabilities = [
      ...(invoiceResult.available ? ['invoice_details', 'bill_details'] : []),
      ...(normalizedBalanceSheet ? ['balance_sheet'] : []),
      ...(revenueAnalytics.revenueEntries.length > 0 ? ['customer_revenue'] : []),
      ...(revenueAnalytics.revenueDimensions.length > 0 ? ['revenue_dimensions'] : []),
    ]

    return {
      cashBalance: findRowValue(balanceRows, 'Bank'),
      accountsReceivable: findRowValue(balanceRows, 'Accounts Receivable'),
      accountsPayable: findRowValue(balanceRows, 'Accounts Payable'),
      monthlyRevenue: findRowValue(profitLossRows, 'Total Income'),
      monthlyExpenses:
        findRowValue(profitLossRows, 'Less Cost of Sales') +
        findRowValue(profitLossRows, 'Less Operating Expenses'),
      currency,
      asOf,
      raw: { balanceSheet, profitLoss },
      detailed: {
        capabilities,
        accounts: [],
        reportingPeriods: normalizedBalanceSheet ? [normalizedBalanceSheet] : [],
        transactions: [],
        budgets: [],
        invoices: invoiceResult.invoices,
        debts: [],
        ...revenueAnalytics,
      },
    }
  }

  verifyWebhookSignature(rawBody: string, headers: Record<string, string>) {
    const webhookKey = process.env.XERO_WEBHOOK_KEY
    const signature = headers['x-xero-signature']
    if (!webhookKey || !signature) return false

    const expected = crypto.createHmac('sha256', webhookKey).update(rawBody).digest('base64')
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  }

  parseWebhookEvent(payload: unknown): WebhookEvent {
    const record = payload as Record<string, unknown>
    const events = (record.events as Array<Record<string, unknown>>) ?? []
    const first = events[0] ?? {}

    return {
      provider: 'xero',
      eventType: String(first.eventType ?? 'unknown'),
      tenantId: String(record.tenantId ?? first.tenantId ?? ''),
      resourceId: first.resourceId ? String(first.resourceId) : undefined,
      raw: payload,
    }
  }
}
