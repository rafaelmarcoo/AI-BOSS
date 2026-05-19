import { render, screen } from '@testing-library/react'
import { DataSourcesPanel } from '@/components/data-sources-panel'

jest.mock('@/components/accounting-connect', () => ({
  AccountingConnect() {
    return <div>Accounting connector</div>
  },
}))

describe('DataSourcesPanel', () => {
  it('renders the unified accounting connector alongside upload source hints', () => {
    render(<DataSourcesPanel />)

    expect(screen.getByText('Accounting connector')).toBeInTheDocument()
    expect(screen.getByText('CSV uploads')).toBeInTheDocument()
    expect(screen.getByText('PDF reports')).toBeInTheDocument()
  })
})
