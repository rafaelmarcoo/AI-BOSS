export type RunwayPolicyStatus = 'urgent' | 'caution' | 'healthy'

export interface RunwayPolicy {
  status: RunwayPolicyStatus
  message: string
  thresholdMonths: number
}

const URGENT_THRESHOLD = 3
const CAUTION_THRESHOLD = 6

export function assessRunwayPolicy(runwayMonths: number): RunwayPolicy {
  if (runwayMonths < URGENT_THRESHOLD) {
    return {
      status: 'urgent',
      message:
        `Urgent: Your runway of ${runwayMonths} months is critically low. ` +
        `Immediate action is required — consider cutting costs or securing emergency funding now.`,
      thresholdMonths: URGENT_THRESHOLD,
    }
  }

  if (runwayMonths < CAUTION_THRESHOLD) {
    return {
      status: 'caution',
      message:
        `Caution: Your runway of ${runwayMonths} months is below the recommended 6-month buffer. ` +
        `Review your burn rate and consider your fundraising options soon.`,
      thresholdMonths: CAUTION_THRESHOLD,
    }
  }

  return {
    status: 'healthy',
    message:
      `Healthy: Your runway of ${runwayMonths} months is above the 6-month recommended minimum.`,
    thresholdMonths: CAUTION_THRESHOLD,
  }
}
