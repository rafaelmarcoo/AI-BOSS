import {
  DAYS_PER_MONTH,
  formatRunway,
} from '@/lib/calculations/runway-display'

export type RunwayPolicyStatus = 'urgent' | 'caution' | 'healthy'

export interface RunwayPolicy {
  status: RunwayPolicyStatus
  message: string
  thresholdMonths: number
  thresholdDays: number
}

const URGENT_THRESHOLD = 3
const CAUTION_THRESHOLD = 6
const URGENT_THRESHOLD_DAYS = URGENT_THRESHOLD * DAYS_PER_MONTH
const CAUTION_THRESHOLD_DAYS = CAUTION_THRESHOLD * DAYS_PER_MONTH

export function assessRunwayPolicy(runwayMonths: number): RunwayPolicy {
  if (!Number.isFinite(runwayMonths)) {
    return {
      status: 'urgent',
      message:
        'Runway could not be assessed because the runway value is unavailable or invalid. ' +
        'Confirm cash, receivables, payables, and monthly burn rate.',
      thresholdMonths: URGENT_THRESHOLD,
      thresholdDays: URGENT_THRESHOLD_DAYS,
    }
  }

  const runway = formatRunway(runwayMonths)

  if (runwayMonths < URGENT_THRESHOLD) {
    return {
      status: 'urgent',
      message:
        `Urgent: Your runway of ${runway} is critically low, below the ${URGENT_THRESHOLD_DAYS}-day (${URGENT_THRESHOLD}-month) threshold. ` +
        'Immediate action is required; consider cutting costs or securing funding.',
      thresholdMonths: URGENT_THRESHOLD,
      thresholdDays: URGENT_THRESHOLD_DAYS,
    }
  }

  if (runwayMonths < CAUTION_THRESHOLD) {
    return {
      status: 'caution',
      message:
        `Caution: Your runway of ${runway} is below the recommended ${CAUTION_THRESHOLD_DAYS}-day (${CAUTION_THRESHOLD}-month) buffer. ` +
        'Review burn rate, collections, and near-term commitments.',
      thresholdMonths: CAUTION_THRESHOLD,
      thresholdDays: CAUTION_THRESHOLD_DAYS,
    }
  }

  return {
    status: 'healthy',
    message:
      `Healthy: Your runway of ${runway} is above the ${CAUTION_THRESHOLD_DAYS}-day (${CAUTION_THRESHOLD}-month) recommended minimum.`,
    thresholdMonths: CAUTION_THRESHOLD,
    thresholdDays: CAUTION_THRESHOLD_DAYS,
  }
}
