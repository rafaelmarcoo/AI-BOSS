/** @jest-environment node */

import { NextRequest } from 'next/server'
import { PATCH as patchItem, POST as addItem } from '@/app/api/documents/[documentId]/items/route'
import { PATCH as updateCurrency } from '@/app/api/documents/[documentId]/currency/route'
import { requireAuthenticatedUser } from '@/lib/auth'
import {
  addDocumentExtractedItem,
  updateDocumentCurrency,
  updateDocumentExtractedItem,
} from '@/lib/documents/persistence'

jest.mock('@/lib/auth', () => ({ requireAuthenticatedUser: jest.fn() }))
jest.mock('@/lib/documents/persistence', () => ({
  addDocumentExtractedItem: jest.fn(),
  updateDocumentCurrency: jest.fn(),
  updateDocumentExtractedItem: jest.fn(),
}))

const mockRequireAuthenticatedUser = jest.mocked(requireAuthenticatedUser)
const mockAddDocumentExtractedItem = jest.mocked(addDocumentExtractedItem)
const mockUpdateDocumentCurrency = jest.mocked(updateDocumentCurrency)
const mockUpdateDocumentExtractedItem = jest.mocked(updateDocumentExtractedItem)
const context = { params: Promise.resolve({ documentId: 'document-1' }) }

describe('supplementary document item routes', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockRequireAuthenticatedUser.mockResolvedValue({
      accessToken: 'token',
      user: { id: 'user-1', email: 'owner@example.com' },
    })
    mockAddDocumentExtractedItem.mockResolvedValue({ id: 'document-1' } as never)
    mockUpdateDocumentExtractedItem.mockResolvedValue({ id: 'document-1' } as never)
    mockUpdateDocumentCurrency.mockResolvedValue({ id: 'document-1' } as never)
  })

  it('edits only the authenticated document metadata service', async () => {
    const response = await patchItem(
      new NextRequest('http://localhost/api/documents/document-1/items', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ index: 0, value: 400, attributes: { quantity: 4 } }),
      }),
      context
    )

    expect(response.status).toBe(200)
    expect(mockUpdateDocumentExtractedItem).toHaveBeenCalledWith({
      documentId: 'document-1',
      requesterId: 'user-1',
      index: 0,
      value: 400,
      attributes: { quantity: 4 },
    })
  })

  it('adds an item whose blank value can be calculated from price and quantity', async () => {
    const response = await addItem(
      new NextRequest('http://localhost/api/documents/document-1/items', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ label: 'Hosting', attributes: { price: '100', quantity: '3' } }),
      }),
      context
    )

    expect(response.status).toBe(200)
    expect(mockAddDocumentExtractedItem).toHaveBeenCalledWith({
      documentId: 'document-1',
      requesterId: 'user-1',
      label: 'Hosting',
      value: null,
      attributes: { price: '100', quantity: '3' },
    })
  })

  it('rejects unsupported currencies before persistence', async () => {
    const response = await updateCurrency(
      new NextRequest('http://localhost/api/documents/document-1/currency', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ currency: 'USD' }),
      }),
      context
    )

    expect(response.status).toBe(400)
    expect(mockUpdateDocumentCurrency).not.toHaveBeenCalled()
  })
})
