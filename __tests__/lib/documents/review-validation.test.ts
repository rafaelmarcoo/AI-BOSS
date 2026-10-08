import {
  validateConfirmDocumentPayload,
  validatePromoteDocumentItemsPayload,
  validateReprocessDocumentPayload,
  validateUpdateDocumentCategoryPayload,
} from '@/lib/documents/review-validation'

describe('document review validation', () => {
  it('accepts corrected included candidates and uncorrected exclusions', () => {
    expect(
      validateConfirmDocumentPayload({
        extractionRunId: 'run-1',
        candidates: [
          {
            candidateId: 'candidate-1',
            decision: 'included',
            metricKey: 'cash',
            value: 125000,
            currency: 'NZD',
            reportingDate: '2026-07-31',
          },
          {
            candidateId: 'candidate-2',
            decision: 'excluded',
          },
        ],
      })
    ).toEqual({
      success: true,
      data: {
        extractionRunId: 'run-1',
        candidates: [
          {
            candidateId: 'candidate-1',
            decision: 'included',
            metricKey: 'cash',
            value: 125000,
            currency: 'NZD',
            reportingDate: '2026-07-31',
          },
          {
            candidateId: 'candidate-2',
            decision: 'excluded',
            metricKey: null,
            value: null,
            currency: null,
            reportingDate: null,
          },
        ],
      },
    })
  })

  it('blocks included candidates with invalid calculation fields', () => {
    const result = validateConfirmDocumentPayload({
      extractionRunId: 'run-1',
      candidates: [
        {
          candidateId: 'candidate-1',
          decision: 'included',
          metricKey: 'cash',
          value: Number.NaN,
          currency: 'USD',
          reportingDate: '2026-02-31',
        },
      ],
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.details).toMatchObject({
        'candidates.0.value': expect.any(String),
        'candidates.0.currency': expect.any(String),
        'candidates.0.reportingDate': expect.any(String),
      })
    }
  })

  it('accepts runway months without currency', () => {
    expect(
      validateConfirmDocumentPayload({
        extractionRunId: 'run-1',
        candidates: [
          {
            candidateId: 'candidate-1',
            decision: 'included',
            metricKey: 'runway_months',
            value: 7,
            currency: null,
            reportingDate: '2026-07-31',
          },
        ],
      })
    ).toEqual({
      success: true,
      data: {
        extractionRunId: 'run-1',
        candidates: [
          {
            candidateId: 'candidate-1',
            decision: 'included',
            metricKey: 'runway_months',
            value: 7,
            currency: null,
            reportingDate: '2026-07-31',
          },
        ],
      },
    })
  })

  it('rejects currency on runway months', () => {
    const result = validateConfirmDocumentPayload({
      extractionRunId: 'run-1',
      candidates: [
        {
          candidateId: 'candidate-1',
          decision: 'included',
          metricKey: 'runway_months',
          value: 7,
          currency: 'NZD',
          reportingDate: '2026-07-31',
        },
      ],
    })

    expect(result).toEqual({
      success: false,
      details: {
        'candidates.0.currency': 'Runway months must not have a currency.',
      },
    })
  })

  it('rejects duplicate candidate decisions', () => {
    const candidate = {
      candidateId: 'candidate-1',
      decision: 'excluded',
    }
    expect(
      validateConfirmDocumentPayload({
        extractionRunId: 'run-1',
        candidates: [candidate, candidate],
      })
    ).toEqual({
      success: false,
      details: { candidates: 'Each candidate may be reviewed only once.' },
    })
  })

  it('normalizes unique worksheet selections and rejects duplicates', () => {
    expect(
      validateReprocessDocumentPayload({
        selectedWorksheetNames: [' Summary ', 'Cash Flow'],
      })
    ).toEqual({
      success: true,
      data: { selectedWorksheetNames: ['Summary', 'Cash Flow'] },
    })
    expect(
      validateReprocessDocumentPayload({
        selectedWorksheetNames: ['Summary', ' Summary '],
      }).success
    ).toBe(false)
  })

  it('accepts an explicit AI-assisted reprocess mode and rejects unknown modes', () => {
    expect(
      validateReprocessDocumentPayload({ extractionMode: 'ai_assisted' })
    ).toEqual({
      success: true,
      data: { extractionMode: 'ai_assisted' },
    })
    expect(
      validateReprocessDocumentPayload({ extractionMode: 'autonomous' }).success
    ).toBe(false)
  })

  it('validates controlled document categories', () => {
    expect(
      validateUpdateDocumentCategoryPayload({
        documentType: 'invoice_receipt',
      })
    ).toEqual({
      success: true,
      data: { documentType: 'invoice_receipt' },
    })
    expect(
      validateUpdateDocumentCategoryPayload({ documentType: 'random' }).success
    ).toBe(false)
  })

  it('validates Item promotion without accepting a client total', () => {
    expect(
      validatePromoteDocumentItemsPayload({
        extractionRunId: 'run-1',
        itemIndexes: [0, 2],
        metricKey: 'monthly_expenses',
        currency: 'NZD',
        reportingDate: '2026-08-31',
        total: 999999,
      })
    ).toEqual({
      success: true,
      data: {
        extractionRunId: 'run-1',
        itemIndexes: [0, 2],
        metricKey: 'monthly_expenses',
        currency: 'NZD',
        reportingDate: '2026-08-31',
      },
    })
  })

  it('rejects invalid, duplicate, empty and non-monetary Item promotions', () => {
    const base = {
      extractionRunId: 'run-1',
      itemIndexes: [0, 0],
      metricKey: 'runway_months',
      currency: 'USD',
      reportingDate: '2026-02-31',
    }
    const result = validatePromoteDocumentItemsPayload(base)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.details).toMatchObject({
        itemIndexes: expect.any(String),
        metricKey: expect.any(String),
        currency: expect.any(String),
        reportingDate: expect.any(String),
      })
    }
  })
})
