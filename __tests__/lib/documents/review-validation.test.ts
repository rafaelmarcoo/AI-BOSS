import {
  validateConfirmDocumentPayload,
  validateReprocessDocumentPayload,
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
})
