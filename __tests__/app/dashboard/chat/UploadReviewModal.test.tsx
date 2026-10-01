import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { UploadReviewModal } from '@/app/dashboard/chat/UploadReviewModal'
import type { DocumentSummaryView } from '@/app/dashboard/chat/types'

function makeDocument(metadata: Record<string, unknown>): DocumentSummaryView {
  return {
    id: 'doc-1',
    conversation_id: null,
    file_name: 'report.pdf',
    file_type: 'pdf',
    mime_type: 'application/pdf',
    storage_path: 'x',
    status: 'ready',
    document_type: 'financial',
    metadata,
    error_message: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  } as unknown as DocumentSummaryView
}

describe('UploadReviewModal item table', () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockImplementation((url: string) =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve(
            url.includes('by-source')
              ? { success: true, data: { metrics: [] } }
              : { success: true, data: {} }
          ),
      })
    ) as jest.Mock
  })

  it('shows one row per item, including repeated labels, with attribute columns', async () => {
    const document = makeDocument({
      extractedMetrics: { Revenue: 203.3 },
      extractedItems: [
        { label: 'Revenue', value: 203.3, attributes: { entity: 'Ressett', unit: 'L$ million' } },
        { label: 'Revenue', value: 187, attributes: { entity: 'Fixxupp', unit: 'L$ million' } },
        { label: 'Staff employed', value: 350, attributes: { unit: 'staff' } },
      ],
    })

    render(<UploadReviewModal uploading={false} document={document} onClose={jest.fn()} />)

    await waitFor(() => expect(screen.queryByText(/Loading extracted data/)).not.toBeInTheDocument())

    expect(screen.getByRole('columnheader', { name: 'unit' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'entity' })).toBeInTheDocument()
    expect(screen.getAllByText('Revenue')).toHaveLength(2)
    expect(screen.getByText('Ressett')).toBeInTheDocument()
    expect(screen.getByText('Fixxupp')).toBeInTheDocument()
    // A row with no entity shows a dash in that column.
    const staffRow = screen.getByText('Staff employed').closest('tr') as HTMLElement
    expect(within(staffRow).getByText('–')).toBeInTheDocument()
  })

  it('saves an edit to the second Revenue row by its position, not its label', async () => {
    const document = makeDocument({
      extractedMetrics: { Revenue: 203.3 },
      extractedItems: [
        { label: 'Revenue', value: 203.3, attributes: { entity: 'Ressett' } },
        { label: 'Revenue', value: 187, attributes: { entity: 'Fixxupp' } },
      ],
    })

    render(<UploadReviewModal uploading={false} document={document} onClose={jest.fn()} />)

    await waitFor(() => expect(screen.queryByText(/Loading extracted data/)).not.toBeInTheDocument())

    await userEvent.click(screen.getByText('187'))
    const input = screen.getByDisplayValue('187')
    await userEvent.clear(input)
    await userEvent.type(input, '190{enter}')

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/documents/doc-1/items',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ index: 1, value: 190 }),
        })
      )
    })
    expect(await screen.findByText('190')).toBeInTheDocument()
    // The first company's Revenue is untouched.
    expect(screen.getByText('203.3')).toBeInTheDocument()
  })

  it('keeps the plain two-column table for documents without an item list', async () => {
    const document = makeDocument({ extractedMetrics: { Rent: 900 } })

    render(<UploadReviewModal uploading={false} document={document} onClose={jest.fn()} />)

    await waitFor(() => expect(screen.queryByText(/Loading extracted data/)).not.toBeInTheDocument())

    expect(screen.getByText('Rent')).toBeInTheDocument()
    expect(screen.getByText('900')).toBeInTheDocument()
    expect(screen.getAllByRole('columnheader')).toHaveLength(2)
  })

  // Answers the by-source call normally and every item call with the given metadata,
  // the way the real server returns the updated document.
  function mockServerReturning(metadata: Record<string, unknown>) {
    global.fetch = jest.fn().mockImplementation((url: string) =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve(
            url.includes('by-source')
              ? { success: true, data: { metrics: [] } }
              : { success: true, data: { document: { metadata } } }
          ),
      })
    ) as jest.Mock
  }

  const twoIcecreams = {
    extractedMetrics: { Icecream: 500 },
    extractedItems: [
      { label: 'Icecream', value: 500, attributes: { department: 'A' } },
      { label: 'Icecream', value: 300, attributes: { department: 'B' } },
    ],
  }

  it('edits an attribute cell by row position and shows the saved result', async () => {
    mockServerReturning({
      ...twoIcecreams,
      extractedItems: [
        twoIcecreams.extractedItems[0],
        { label: 'Icecream', value: 300, attributes: { department: 'C' } },
      ],
    })

    render(
      <UploadReviewModal uploading={false} document={makeDocument(twoIcecreams)} onClose={jest.fn()} />
    )
    await waitFor(() => expect(screen.queryByText(/Loading extracted data/)).not.toBeInTheDocument())

    await userEvent.click(screen.getByText('B'))
    const input = screen.getByDisplayValue('B')
    await userEvent.clear(input)
    await userEvent.type(input, 'C{enter}')

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/documents/doc-1/items',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ index: 1, attributes: { department: 'C' } }),
        })
      )
    })
    expect(await screen.findByText('C')).toBeInTheDocument()
    expect(screen.queryByText('B')).not.toBeInTheDocument()
  })

  it('adds a new attribute column and fills a cell in it', async () => {
    mockServerReturning({
      ...twoIcecreams,
      extractedItems: [
        { label: 'Icecream', value: 500, attributes: { department: 'A', warehouse: 1 } },
        twoIcecreams.extractedItems[1],
      ],
    })

    render(
      <UploadReviewModal uploading={false} document={makeDocument(twoIcecreams)} onClose={jest.fn()} />
    )
    await waitFor(() => expect(screen.queryByText(/Loading extracted data/)).not.toBeInTheDocument())

    await userEvent.click(screen.getByText('Add column'))
    await userEvent.type(screen.getByPlaceholderText(/Column name/), 'Warehouse{enter}')

    // The new column exists straight away, blank for every row.
    expect(screen.getByRole('columnheader', { name: 'Warehouse' })).toBeInTheDocument()
    const firstRow = screen.getAllByText('Icecream')[0].closest('tr') as HTMLElement
    await userEvent.click(within(firstRow).getByText('–'))
    await userEvent.type(screen.getByRole('textbox'), '1{enter}')

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/documents/doc-1/items',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ index: 0, attributes: { Warehouse: '1' } }),
        })
      )
    })
  })

  it('does not let the same column name be added twice', async () => {
    render(
      <UploadReviewModal uploading={false} document={makeDocument(twoIcecreams)} onClose={jest.fn()} />
    )
    await waitFor(() => expect(screen.queryByText(/Loading extracted data/)).not.toBeInTheDocument())

    await userEvent.click(screen.getByText('Add column'))
    await userEvent.type(screen.getByPlaceholderText(/Column name/), 'Department{enter}')

    expect(await screen.findByText('A column with that name already exists.')).toBeInTheDocument()
  })

  it('adds a new row as an item, even when the name already exists', async () => {
    mockServerReturning({
      ...twoIcecreams,
      extractedItems: [
        ...twoIcecreams.extractedItems,
        { label: 'Icecream', value: 120, attributes: {} },
      ],
    })

    render(
      <UploadReviewModal uploading={false} document={makeDocument(twoIcecreams)} onClose={jest.fn()} />
    )
    await waitFor(() => expect(screen.queryByText(/Loading extracted data/)).not.toBeInTheDocument())

    await userEvent.click(screen.getByText('Add metric'))
    await userEvent.type(screen.getByPlaceholderText('Metric name'), 'Icecream')
    await userEvent.type(screen.getByPlaceholderText('Value'), '120{enter}')

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/documents/doc-1/items',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ label: 'Icecream', value: 120 }),
        })
      )
    })
    expect(await screen.findByText('120')).toBeInTheDocument()
    expect(screen.getAllByText('Icecream')).toHaveLength(3)
  })
})
