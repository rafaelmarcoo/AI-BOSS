import { render, screen } from '@testing-library/react'
import { DataSourcesPanel } from '@/components/data-sources-panel'

describe('DataSourcesPanel', () => {
  it('shows only the supported reviewed document sources', () => {
    render(<DataSourcesPanel />)

    expect(screen.getByText('CSV files')).toBeInTheDocument()
    expect(screen.getByText('XLSX workbooks')).toBeInTheDocument()
    expect(screen.getByText('PDF reports')).toBeInTheDocument()
    expect(screen.queryByText(/Xero/i)).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open documents' })).toHaveAttribute(
      'href',
      '/dashboard/documents',
    )
  })
})
