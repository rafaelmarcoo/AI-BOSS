export interface DemoXeroStatus {
  connected: true
  demo: true
  tenantId: string
  tenantName: string
  connectedAt: string
  expiresAt: null
  updatedAt: string
}

export function isXeroDemoMode() {
  return process.env.XERO_DEMO_MODE === 'true'
}

export function getDemoXeroStatus(): DemoXeroStatus {
  const timestamp = new Date().toISOString()

  return {
    connected: true,
    demo: true,
    tenantId: 'demo-xero-tenant',
    tenantName: 'Demo Company NZ',
    connectedAt: timestamp,
    expiresAt: null,
    updatedAt: timestamp,
  }
}
