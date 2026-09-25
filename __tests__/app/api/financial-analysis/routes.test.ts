/** @jest-environment node */

import { NextRequest } from 'next/server'
import { GET as getBaselines } from '@/app/api/financial-analysis/baselines/route'
import { POST as previewTimeline } from '@/app/api/financial-analysis/preview/route'
import { GET as listReports, POST as runAnalysis } from '@/app/api/financial-analysis/route'
import {
  DELETE as deleteReport,
  GET as getReport,
} from '@/app/api/financial-analysis/[analysisRunId]/route'
import { requireAuthenticatedUser } from '@/lib/auth'
import { listFinancialAnalysisBaselineOptions } from '@/lib/financial-analysis/baselines'
import { runFinancialAnalysis } from '@/lib/financial-analysis/orchestrator'
import { previewFinancialAnalysis } from '@/lib/financial-analysis/timeline'
import {
  deleteFinancialAnalysisRun,
  getFinancialAnalysisRun,
  listFinancialAnalysisRuns,
  toFinancialAnalysisRunView,
} from '@/lib/financial-analysis/persistence'

jest.mock('@/lib/auth', () => ({ requireAuthenticatedUser: jest.fn() }))
jest.mock('@/lib/financial-analysis/baselines', () => ({
  listFinancialAnalysisBaselineOptions: jest.fn(),
}))
jest.mock('@/lib/financial-analysis/orchestrator', () => ({
  runFinancialAnalysis: jest.fn(),
}))
jest.mock('@/lib/financial-analysis/timeline', () => ({
  ...jest.requireActual('@/lib/financial-analysis/timeline'),
  previewFinancialAnalysis: jest.fn(),
}))
jest.mock('@/lib/financial-analysis/persistence', () => ({
  deleteFinancialAnalysisRun: jest.fn(),
  getFinancialAnalysisRun: jest.fn(),
  listFinancialAnalysisRuns: jest.fn(),
  toFinancialAnalysisRunView: jest.fn(),
}))

const mockAuth = jest.mocked(requireAuthenticatedUser)
const mockBaselines = jest.mocked(listFinancialAnalysisBaselineOptions)
const mockRun = jest.mocked(runFinancialAnalysis)
const mockPreview = jest.mocked(previewFinancialAnalysis)
const mockGet = jest.mocked(getFinancialAnalysisRun)
const mockDelete = jest.mocked(deleteFinancialAnalysisRun)
const mockList = jest.mocked(listFinancialAnalysisRuns)
const mockToView = jest.mocked(toFinancialAnalysisRunView)

describe('financial analysis API routes', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockAuth.mockResolvedValue({
      accessToken: 'token',
      user: { id: 'owner-1', email: 'owner@example.com' },
    })
  })

  it('loads baseline choices and report summaries only for the authenticated owner', async () => {
    mockBaselines.mockResolvedValue([])
    mockList.mockResolvedValue([])

    expect((await getBaselines(new NextRequest('http://localhost/api/financial-analysis/baselines'))).status).toBe(200)
    expect((await listReports(new NextRequest('http://localhost/api/financial-analysis'))).status).toBe(200)
    expect(mockBaselines).toHaveBeenCalledWith('owner-1')
    expect(mockList).toHaveBeenCalledWith('owner-1')
  })

  it('runs and returns an immutable report for the authenticated owner', async () => {
    const body = { sourceKey: 'document:doc-1', currency: 'NZD' }
    const savedRun = { id: 'analysis-1' }
    const view = { id: 'analysis-1', result: { version: 'financial-analysis-v1' } }
    mockRun.mockResolvedValue(savedRun as never)
    mockToView.mockReturnValue(view as never)

    const response = await runAnalysis(new NextRequest('http://localhost/api/financial-analysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }))

    expect(response.status).toBe(201)
    expect(mockRun).toHaveBeenCalledWith({ userId: 'owner-1', request: body })
    expect(mockToView).toHaveBeenCalledWith(savedRun)
  })

  it('previews a selected statement timeline for the authenticated owner', async () => {
    const body = {
      mode: 'timeline' as const,
      sourceKeys: ['document:doc-1', 'document:doc-2'],
      currency: 'NZD' as const,
    }
    const preview = {
      mode: 'timeline' as const,
      currency: 'NZD' as const,
      selectedSources: [],
      reportingDates: ['2026-05-31', '2026-06-30'],
      metricCoverage: [],
      warnings: [],
      suggestedLatestDate: '2026-06-30',
      conflicts: [],
    }
    mockPreview.mockResolvedValue(preview)

    const response = await previewTimeline(new NextRequest(
      'http://localhost/api/financial-analysis/preview',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }
    ))

    expect(response.status).toBe(200)
    expect(mockPreview).toHaveBeenCalledWith({ userId: 'owner-1', request: body })
  })

  it('loads a report detail through an owner-bound lookup', async () => {
    mockGet.mockResolvedValue({ id: 'analysis-1' } as never)
    const response = await getReport(
      new NextRequest('http://localhost/api/financial-analysis/analysis-1'),
      { params: Promise.resolve({ analysisRunId: 'analysis-1' }) }
    )

    expect(response.status).toBe(200)
    expect(mockGet).toHaveBeenCalledWith('analysis-1', 'owner-1')
  })

  it('deletes a report through an owner-bound service', async () => {
    mockDelete.mockResolvedValue({ deleted: true })
    const response = await deleteReport(
      new NextRequest('http://localhost/api/financial-analysis/analysis-1', {
        method: 'DELETE',
      }),
      { params: Promise.resolve({ analysisRunId: 'analysis-1' }) }
    )

    expect(response.status).toBe(200)
    expect(mockDelete).toHaveBeenCalledWith('analysis-1', 'owner-1')
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: { deleted: true, analysisRunId: 'analysis-1' },
    })
  })
})
