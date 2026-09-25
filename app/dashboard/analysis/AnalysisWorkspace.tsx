'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded'
import PictureAsPdfRoundedIcon from '@mui/icons-material/PictureAsPdfRounded'
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded'
import { dashboardTokens } from '@/app/theme'
import { AnalysisTrendForecastSection } from './AnalysisTrendForecastSection'
import type { FinancialAnalysisBaselineOption } from '@/lib/financial-analysis/baselines'
import type { FinancialAnalysisTimelinePreview } from '@/lib/financial-analysis/timeline'
import {
  getCurrentRunwayResult,
  getPolicyRuleStatusLabel,
  type CurrentRunwayResult,
} from '@/lib/financial-analysis/report-presentation'
import type { FinancialMetricKey } from '@/lib/financial-data/metric-keys'
import type {
  FinancialAnalysisRunSummary,
  FinancialAnalysisRunView,
} from '@/lib/financial-analysis/persistence'

interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: { message?: string }
}

const METRIC_LABELS: Record<string, string> = {
  cash: 'Cash',
  accounts_receivable: 'Accounts receivable',
  accounts_payable: 'Accounts payable',
  monthly_revenue: 'Monthly revenue',
  monthly_expenses: 'Monthly expenses',
  burn_rate: 'Burn rate',
  runway_months: 'Runway',
  cash_runway_months: 'Cash runway',
  working_capital_adjusted_runway_months: 'Adjusted runway',
}

const RECOMMENDATION_LABELS: Record<string, string> = {
  fix_data_gaps: 'Fix data gaps',
  protect_runway_now: 'Protect runway now',
  restore_operating_balance: 'Restore operating balance',
  address_worsening_cash_or_burn: 'Address worsening cash or burn',
  improve_collections_and_payable_timing: 'Improve collections and payable timing',
  build_runway_buffer: 'Build runway buffer',
}

const REPORT_NAVIGATION = [
  { id: 'analysis-summary', label: 'Summary' },
  { id: 'analysis-position', label: 'Position' },
  { id: 'analysis-period-comparison', label: 'Period comparison' },
  { id: 'analysis-history-forecast', label: 'History and forecast' },
  { id: 'analysis-risks', label: 'Risks' },
  { id: 'analysis-actions', label: 'Actions' },
  { id: 'analysis-evidence', label: 'Evidence' },
] as const

const POLICY_RESULT_PRESENTATION: Record<CurrentRunwayResult, {
  label: string
  detail: string
  color: string
}> = {
  urgent: {
    label: 'Urgent',
    detail: 'Cash runway is under 3 months and needs urgent attention.',
    color: '#ef4444',
  },
  caution: {
    label: 'Caution',
    detail: 'Cash runway is from 3 months to under 6 months.',
    color: '#f59e0b',
  },
  healthy: {
    label: 'Healthy',
    detail: 'Cash runway is at least 6 months.',
    color: dashboardTokens.positive,
  },
  not_evaluated: {
    label: 'Not evaluated',
    detail: 'Compatible cash and burn-rate inputs are required to evaluate runway.',
    color: dashboardTokens.textMuted,
  },
}

interface EvidenceFilter {
  label: string
  metricKeys: FinancialMetricKey[]
}

function formatAmount(value: number, currency: 'NZD' | 'AUD') {
  return new Intl.NumberFormat('en-NZ', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value)
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-NZ', {
    dateStyle: 'medium',
    timeStyle: value.includes('T') ? 'short' : undefined,
  }).format(new Date(value.includes('T') ? value : `${value}T00:00:00`))
}

function formatReportingDate(value: string) {
  return new Intl.DateTimeFormat('en-NZ', { dateStyle: 'medium' })
    .format(new Date(`${value}T00:00:00`))
}

function formatComparisonValue(
  metricKey: string,
  value: number,
  currency: 'NZD' | 'AUD'
) {
  return metricKey.endsWith('runway_months')
    ? `${value.toFixed(1)} months`
    : formatAmount(value, currency)
}

function formatComparisonChange(
  metricKey: string,
  change: { absolute: number; percentage: number | null } | null,
  currency: 'NZD' | 'AUD'
) {
  if (!change) return 'Unavailable'
  const value = metricKey.endsWith('runway_months')
    ? `${change.absolute >= 0 ? '+' : ''}${change.absolute.toFixed(1)} months`
    : `${change.absolute >= 0 ? '+' : ''}${formatAmount(change.absolute, currency)}`
  return change.percentage === null
    ? `${value} · percentage unavailable`
    : `${value} · ${change.percentage >= 0 ? '+' : ''}${change.percentage.toFixed(1)}%`
}

function statusColor(status: string) {
  if (status === 'ready' || status === 'complete' || status === 'passed') {
    return dashboardTokens.positive
  }
  if (status === 'action_required' || status === 'triggered' || status === 'block') {
    return dashboardTokens.warning
  }
  return dashboardTokens.textMuted
}

function Panel(props: { title: string; children: React.ReactNode }) {
  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, borderColor: dashboardTokens.border }}>
      <Typography variant="h6" sx={{ mb: 1.5 }}>{props.title}</Typography>
      {props.children}
    </Paper>
  )
}

function MetricCard(props: {
  label: string
  value: string
  detail: string
  onViewEvidence: () => void
}) {
  return (
    <Paper variant="outlined" sx={{ p: 2, minWidth: 0, borderColor: dashboardTokens.border }}>
      <Typography variant="caption" sx={{ color: dashboardTokens.textMuted }}>{props.label}</Typography>
      <Typography variant="h5" sx={{ mt: 0.5 }}>{props.value}</Typography>
      <Typography variant="caption" sx={{ color: dashboardTokens.textSubtle }}>{props.detail}</Typography>
      <Button
        className="analysis-screen-only"
        size="small"
        onClick={props.onViewEvidence}
        aria-label={`View evidence for ${props.label}`}
        sx={{ display: 'flex', mt: 1.25, px: 0, minWidth: 0, textTransform: 'none' }}
      >
        View evidence
      </Button>
    </Paper>
  )
}

export function ReportView({ report }: { report: FinancialAnalysisRunView }) {
  const result = report.result
  const { currency } = result.selectedBaseline
  const runway = result.facts.runway
  const operatingBalance = result.facts.operatingBalance
  const workingCapital = result.facts.receivablesPayables
  const hasCurrentCash = result.evidence.some((item) =>
    item.metricKey === 'cash' &&
    item.reportingDate === result.selectedBaseline.reportDate &&
    item.usedInCalculations
  )
  const [evidenceFilter, setEvidenceFilter] = useState<EvidenceFilter | null>(null)
  const [evidenceExpanded, setEvidenceExpanded] = useState(false)
  const evidenceSectionRef = useRef<HTMLDivElement>(null)
  const policyResult = POLICY_RESULT_PRESENTATION[
    getCurrentRunwayResult(result.policy)
  ]
  const titleDate = formatReportingDate(result.selectedBaseline.reportDate)
  const hasMultipleReportingDates =
    result.selectedBaseline.reportingPeriodStart !==
    result.selectedBaseline.reportingPeriodEnd
  const reportTitle = hasMultipleReportingDates
    ? `Financial Analysis — through ${titleDate}`
    : `Financial Analysis — as at ${titleDate}`
  const dateRange = hasMultipleReportingDates
    ? `${formatReportingDate(result.selectedBaseline.reportingPeriodStart)} – ${formatReportingDate(result.selectedBaseline.reportingPeriodEnd)}`
    : formatReportingDate(result.selectedBaseline.reportingPeriodEnd)

  function showEvidence(filter: EvidenceFilter) {
    setEvidenceFilter(filter)
    setEvidenceExpanded(true)
    window.setTimeout(() => {
      evidenceSectionRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    }, 0)
  }

  function printReport() {
    const originalTitle = document.title
    const safeSourceName = result.selectedBaseline.sourceLabel
      .replace(/\.[^.]+$/, '')
      .replace(/[^a-z0-9]+/gi, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase()
    document.title = [
      'AI-BOSS-financial-analysis',
      safeSourceName,
      currency,
      report.createdAt.slice(0, 10),
    ].filter(Boolean).join('-')
    const restoreTitle = () => {
      document.title = originalTitle
    }
    window.addEventListener('afterprint', restoreTitle, { once: true })
    try {
      window.print()
    } finally {
      // Safari can reject repeated programmatic print requests without firing
      // afterprint. Restore the application title in that path as well.
      window.setTimeout(restoreTitle, 0)
    }
  }

  function prepareScenarioHandoff() {
    window.sessionStorage.setItem(
      'ai-boss-scenario-draft',
      JSON.stringify({ analysisRunId: report.id })
    )
  }

  return (
    <Stack className="analysis-report" spacing={2.5}>
      <Paper className="analysis-report-section" variant="outlined" sx={{ p: { xs: 2, sm: 3 }, borderColor: dashboardTokens.border }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={2}>
          <Stack spacing={0.75}>
            <Typography variant="overline" sx={{ color: dashboardTokens.textMuted }}>Financial analysis</Typography>
            <Typography variant="h4">{reportTitle}</Typography>
            <Typography variant="body2" sx={{ color: dashboardTokens.textMuted }}>
              {currency} · {result.selectedBaseline.sources.length} {result.selectedBaseline.sources.length === 1 ? 'source' : 'sources'} · {dateRange}
            </Typography>
            <Typography variant="caption" sx={{ color: dashboardTokens.textSubtle }}>
              Source: {result.selectedBaseline.sourceLabel} · Generated {formatDate(report.createdAt)}
            </Typography>
          </Stack>
          <Stack direction="row" spacing={1} alignItems="flex-start" flexWrap="wrap" useFlexGap>
            <Button
              className="analysis-screen-only"
              variant="outlined"
              size="small"
              startIcon={<PictureAsPdfRoundedIcon />}
              onClick={printReport}
            >
              Save as PDF
            </Button>
            <Chip
              size="small"
              label={result.readiness.status.replaceAll('_', ' ')}
              sx={{ color: statusColor(result.readiness.status), borderColor: statusColor(result.readiness.status) }}
              variant="outlined"
            />
            {result.agentTrace.fallbackUsed ? (
              <Chip size="small" label="Deterministic fallback used" variant="outlined" />
            ) : null}
          </Stack>
        </Stack>
      </Paper>

      <Paper
        className="analysis-screen-only"
        component="nav"
        aria-label="Report sections"
        variant="outlined"
        sx={{
          position: 'sticky',
          top: 12,
          zIndex: 10,
          p: 1,
          borderColor: dashboardTokens.border,
          bgcolor: dashboardTokens.surface,
          overflowX: 'auto',
        }}
      >
        <Stack direction="row" spacing={0.5} sx={{ width: 'max-content' }}>
          {REPORT_NAVIGATION.map((item) => (
            <Button
              key={item.id}
              component="a"
              href={`#${item.id}`}
              size="small"
              onClick={item.id === 'analysis-evidence'
                ? () => setEvidenceExpanded(true)
                : undefined}
              sx={{ color: dashboardTokens.textSoft, textTransform: 'none' }}
            >
              {item.label}
            </Button>
          ))}
        </Stack>
      </Paper>

      <Box id="analysis-summary" className="analysis-report-section analysis-report-anchor"><Panel title="Executive summary">
        <Typography sx={{ color: dashboardTokens.textSoft }}>{result.narrative.executiveSummary}</Typography>
      </Panel></Box>

      <Box id="analysis-position" className="analysis-report-section analysis-report-anchor" sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 2 }}>
        <MetricCard
          label="Current cash runway"
          value={runway ? `${runway.cashRunwayMonths.toFixed(1)} months` : 'Unavailable'}
          detail={runway ? `${formatAmount(runway.cash, currency)} cash at ${formatAmount(runway.monthlyBurnRate, currency)} monthly burn` : 'Compatible cash and burn-rate observations are required.'}
          onViewEvidence={() => showEvidence({
            label: 'Current cash runway',
            metricKeys: ['cash', 'burn_rate'],
          })}
        />
        <MetricCard
          label="Monthly operating balance"
          value={operatingBalance ? formatAmount(operatingBalance.operatingBalance, currency) : 'Unavailable'}
          detail={operatingBalance ? `${formatAmount(operatingBalance.monthlyRevenue, currency)} revenue less ${formatAmount(operatingBalance.monthlyExpenses, currency)} expenses` : 'Compatible revenue and expense observations are required.'}
          onViewEvidence={() => showEvidence({
            label: 'Monthly operating balance',
            metricKeys: ['monthly_revenue', 'monthly_expenses'],
          })}
        />
        <MetricCard
          label="Receivables less payables"
          value={workingCapital ? formatAmount(workingCapital.netPosition, currency) : 'Unavailable'}
          detail={workingCapital ? `${formatAmount(workingCapital.accountsReceivable, currency)} receivable and ${formatAmount(workingCapital.accountsPayable, currency)} payable` : 'Compatible receivable and payable observations are required.'}
          onViewEvidence={() => showEvidence({
            label: 'Receivables less payables',
            metricKeys: ['accounts_receivable', 'accounts_payable'],
          })}
        />
      </Box>

      <Box id="analysis-period-comparison" className="analysis-report-section analysis-report-anchor">
        <Panel title="Financial position">
          <Typography sx={{ color: dashboardTokens.textSoft }}>{result.narrative.financialPosition}</Typography>
        </Panel>
        <Box sx={{ mt: 2 }}><Panel title="Period comparison">
          <Typography sx={{ mb: 2, color: dashboardTokens.textSoft }}>{result.narrative.trendAndForecast}</Typography>
          <TableContainer>
            <Table className="analysis-wide-table" size="small" aria-label="Financial period comparison">
              <TableHead>
                <TableRow>
                  <TableCell>Metric</TableCell>
                  <TableCell>Earliest</TableCell>
                  <TableCell>Previous</TableCell>
                  <TableCell>Latest</TableCell>
                  <TableCell>Start to latest</TableCell>
                  <TableCell>Previous to latest</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {result.facts.periodComparisons.map((comparison) => (
                  <TableRow key={comparison.metricKey}>
                    <TableCell>
                      <Typography variant="body2" fontWeight={650}>
                        {METRIC_LABELS[comparison.metricKey]}
                      </Typography>
                      {comparison.unavailableReason ? (
                        <Typography variant="caption" sx={{ color: dashboardTokens.textMuted }}>
                          {comparison.unavailableReason}
                        </Typography>
                      ) : null}
                    </TableCell>
                    {[comparison.earliest, comparison.previous, comparison.latest].map((point, index) => (
                      <TableCell key={index}>
                        {point ? (
                          <>
                            <Typography variant="body2">
                              {formatComparisonValue(comparison.metricKey, point.value, currency)}
                            </Typography>
                            <Typography variant="caption" sx={{ color: dashboardTokens.textMuted }}>
                              {formatReportingDate(point.reportingDate)}
                            </Typography>
                          </>
                        ) : 'Unavailable'}
                      </TableCell>
                    ))}
                    <TableCell>{formatComparisonChange(comparison.metricKey, comparison.startToLatestChange, currency)}</TableCell>
                    <TableCell>{formatComparisonChange(comparison.metricKey, comparison.previousToLatestChange, currency)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Panel></Box>
      </Box>

      <Box id="analysis-history-forecast" className="analysis-report-anchor">
        <AnalysisTrendForecastSection
          history={result.facts.history}
          forecasts={result.facts.forecasts}
          currency={currency}
          onViewEvidence={(metricKey, label) => showEvidence({
            label,
            metricKeys: [metricKey],
          })}
        />
      </Box>

      <Box className="analysis-report-section" sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 2 }}>
        <Box id="analysis-risks" className="analysis-report-anchor">
        <Panel title="Risks and policy">
          <Stack spacing={1.5}>
            {result.narrative.risks.map((risk) => <Typography key={risk}>• {risk}</Typography>)}
            <Divider />
            <Paper
              variant="outlined"
              sx={{
                p: 2,
                borderColor: policyResult.color,
                borderLeftWidth: 4,
                bgcolor: 'transparent',
              }}
            >
              <Typography variant="overline" sx={{ color: dashboardTokens.textMuted }}>
                Runway result
              </Typography>
              <Typography variant="h5" sx={{ color: policyResult.color }}>
                {policyResult.label}
              </Typography>
              <Typography variant="body2" sx={{ mt: 0.5, color: dashboardTokens.textSoft }}>
                {policyResult.detail}
              </Typography>
            </Paper>
            <Typography fontWeight={650}>Detailed rules</Typography>
            {result.policy.rules.map((rule) => (
              <Stack key={rule.ruleId} direction="row" spacing={1} alignItems="flex-start">
                <Chip
                  size="small"
                  label={getPolicyRuleStatusLabel(rule.status)}
                  variant="outlined"
                  sx={{
                    color: rule.status === 'not_applicable'
                      ? dashboardTokens.textMuted
                      : dashboardTokens.textSoft,
                    borderColor: dashboardTokens.borderSoft,
                  }}
                />
                <Typography variant="body2" sx={{ color: dashboardTokens.textSoft }}>{rule.message}</Typography>
              </Stack>
            ))}
          </Stack>
        </Panel>
        </Box>
        <Box id="analysis-actions" className="analysis-report-anchor">
        <Panel title="Recommended next actions">
          <Stack spacing={1.5}>
            <Button
              className="analysis-screen-only"
              component={Link}
              href="/dashboard/scenarios"
              variant="contained"
              startIcon={<PlayArrowRoundedIcon />}
              disabled={!hasCurrentCash}
              onClick={prepareScenarioHandoff}
              sx={{ alignSelf: 'flex-start' }}
            >
              Test a decision in Scenarios
            </Button>
            {!hasCurrentCash ? (
              <Typography variant="caption" sx={{ color: dashboardTokens.textMuted }}>
                A current cash value is required before this report can be used as a Scenario baseline.
              </Typography>
            ) : null}
            {result.recommendations.map((recommendation) => (
              <Box key={recommendation.id}>
                <Typography fontWeight={650}>{recommendation.priority}. {RECOMMENDATION_LABELS[recommendation.id] ?? recommendation.id.replaceAll('_', ' ')}</Typography>
                <Typography variant="body2" sx={{ color: dashboardTokens.textMuted }}>{recommendation.reason}</Typography>
              </Box>
            ))}
          </Stack>
        </Panel>
        </Box>
      </Box>

      <Accordion className="analysis-print-expand" variant="outlined">
        <AccordionSummary expandIcon={<ExpandMoreRoundedIcon />}><Typography fontWeight={650}>Readiness and limitations</Typography></AccordionSummary>
        <AccordionDetails>
          <Stack spacing={1}>
            {result.readiness.reasons.map((reason) => <Typography key={reason}>• {reason}</Typography>)}
            {result.narrative.limitations.map((item) => <Typography key={item}>• {item}</Typography>)}
            {result.assumptions.map((item) => <Typography key={item}>• {item}</Typography>)}
          </Stack>
        </AccordionDetails>
      </Accordion>

      <Box
        id="analysis-evidence"
        ref={evidenceSectionRef}
        className="analysis-report-anchor"
      >
      <Accordion
        className="analysis-print-expand"
        variant="outlined"
        expanded={evidenceExpanded}
        onChange={(_, expanded) => setEvidenceExpanded(expanded)}
      >
        <AccordionSummary expandIcon={<ExpandMoreRoundedIcon />}><Typography fontWeight={650}>Evidence and processing trace</Typography></AccordionSummary>
        <AccordionDetails>
          <Stack spacing={2}>
            {evidenceFilter ? (
              <Stack
                className="analysis-screen-only"
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1}
                alignItems={{ sm: 'center' }}
                justifyContent="space-between"
              >
                <Typography variant="body2" sx={{ color: dashboardTokens.textSoft }}>
                  Showing evidence for <strong>{evidenceFilter.label}</strong>
                </Typography>
                <Button
                  size="small"
                  onClick={() => setEvidenceFilter(null)}
                  sx={{ alignSelf: { xs: 'flex-start', sm: 'auto' }, textTransform: 'none' }}
                >
                  Show all evidence
                </Button>
              </Stack>
            ) : null}
            <TableContainer>
              <Table className="analysis-wide-table" size="small" aria-label="Financial analysis evidence">
                <TableHead><TableRow><TableCell>Metric</TableCell><TableCell>Date</TableCell><TableCell align="right">Value</TableCell><TableCell>Source and provenance</TableCell><TableCell>Use</TableCell></TableRow></TableHead>
                <TableBody>
                  {result.evidence.map((item) => {
                    const matchesFilter = evidenceFilter === null ||
                      evidenceFilter.metricKeys.includes(item.metricKey)
                    return (
                    <TableRow
                      key={item.observationId}
                      className={matchesFilter
                        ? evidenceFilter ? 'analysis-evidence-highlighted' : undefined
                        : 'analysis-evidence-filtered-out'}
                      sx={matchesFilter && evidenceFilter
                        ? { bgcolor: 'rgba(79, 125, 243, 0.14)' }
                        : undefined}
                    >
                      <TableCell>{METRIC_LABELS[item.metricKey]}</TableCell>
                      <TableCell>{formatDate(item.reportingDate)}</TableCell>
                      <TableCell align="right">{formatAmount(item.value, currency)}</TableCell>
                      <TableCell>
                        <Typography variant="body2">{item.sourceLabel}</Typography>
                        <Typography variant="caption" sx={{ display: 'block', color: dashboardTokens.textMuted }}>
                          {item.sourceType} · {item.sourceKey} · confidence {(item.confidence * 100).toFixed(0)}%
                        </Typography>
                        {item.documentId ? (
                          <Typography variant="caption" sx={{ display: 'block', color: dashboardTokens.textMuted }}>
                            Document ID: {item.documentId}
                          </Typography>
                        ) : null}
                        {item.connectionId ? (
                          <Typography variant="caption" sx={{ display: 'block', color: dashboardTokens.textMuted }}>
                            Connection ID: {item.connectionId}
                          </Typography>
                        ) : null}
                        {item.documentId ? (
                          <Button
                            component={Link}
                            href={`/dashboard/documents/${item.documentId}`}
                            size="small"
                            sx={{ px: 0, minWidth: 0, textTransform: 'none' }}
                          >
                            Review source document
                          </Button>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          variant="outlined"
                          label={item.resolution.replaceAll('_', ' ')}
                          color={item.usedInCalculations ? 'default' : 'warning'}
                        />
                      </TableCell>
                    </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </TableContainer>
            <Divider />
            {result.agentTrace.entries.map((entry) => (
              <Typography key={entry.step} variant="body2" sx={{ color: dashboardTokens.textMuted }}>
                {entry.step.replaceAll('_', ' ')} — {entry.status.replaceAll('_', ' ')} ({entry.execution})
              </Typography>
            ))}
          </Stack>
        </AccordionDetails>
      </Accordion>
      </Box>
    </Stack>
  )
}

export function AnalysisWorkspace() {
  const [baselines, setBaselines] = useState<FinancialAnalysisBaselineOption[]>([])
  const [reports, setReports] = useState<FinancialAnalysisRunSummary[]>([])
  const [selectionMode, setSelectionMode] = useState<'single' | 'timeline'>('single')
  const [selectedIndex, setSelectedIndex] = useState('')
  const [timelineCurrency, setTimelineCurrency] = useState<'NZD' | 'AUD'>('NZD')
  const [timelineSourceKeys, setTimelineSourceKeys] = useState<string[]>([])
  const [timelinePreview, setTimelinePreview] = useState<FinancialAnalysisTimelinePreview | null>(null)
  const [conflictResolutions, setConflictResolutions] = useState<Record<string, string>>({})
  const [activeReport, setActiveReport] = useState<FinancialAnalysisRunView | null>(null)
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const [loadingReportId, setLoadingReportId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const selectedBaseline = useMemo(
    () => selectedIndex === '' ? null : baselines[Number(selectedIndex)] ?? null,
    [baselines, selectedIndex]
  )
  const compatibleTimelineBaselines = useMemo(
    () => baselines.filter((baseline) => baseline.currency === timelineCurrency),
    [baselines, timelineCurrency]
  )
  const allTimelineConflictsResolved = timelinePreview?.conflicts.every(
    (conflict) => Boolean(conflictResolutions[conflict.conflictId])
  ) ?? false

  function clearTimelinePreview() {
    setTimelinePreview(null)
    setConflictResolutions({})
  }

  function selectCompatibleLastSixMonths() {
    const ordered = [...compatibleTimelineBaselines].sort((left, right) =>
      right.latestReportingDate.localeCompare(left.latestReportingDate)
    )
    const latestDate = ordered[0]?.latestReportingDate
    if (!latestDate) return
    const cutoff = new Date(`${latestDate}T00:00:00.000Z`)
    cutoff.setUTCMonth(cutoff.getUTCMonth() - 6)
    const cutoffDate = cutoff.toISOString().slice(0, 10)
    setTimelineSourceKeys(
      ordered
        .filter((baseline) => baseline.latestReportingDate >= cutoffDate)
        .slice(0, 12)
        .map((baseline) => baseline.sourceKey)
    )
    clearTimelinePreview()
  }

  async function previewTimeline() {
    if (timelineSourceKeys.length < 2) return
    setPreviewing(true)
    setError(null)
    try {
      const response = await fetch('/api/financial-analysis/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'timeline',
          sourceKeys: timelineSourceKeys,
          currency: timelineCurrency,
        }),
      })
      const payload = await response.json() as ApiResponse<{
        preview: FinancialAnalysisTimelinePreview
      }>
      if (!response.ok || !payload.success || !payload.data?.preview) {
        throw new Error(payload.error?.message ?? 'Could not preview the statement timeline.')
      }
      setTimelinePreview(payload.data.preview)
      setConflictResolutions({})
    } catch (previewError) {
      setError(previewError instanceof Error
        ? previewError.message
        : 'Could not preview the statement timeline.')
    } finally {
      setPreviewing(false)
    }
  }

  async function loadReport(reportId: string) {
    setLoadingReportId(reportId)
    setError(null)
    try {
      const response = await fetch(`/api/financial-analysis/${reportId}`)
      const payload = await response.json() as ApiResponse<{ report: FinancialAnalysisRunView }>
      if (!response.ok || !payload.success || !payload.data?.report) {
        throw new Error(payload.error?.message ?? 'Could not load the saved report.')
      }
      setActiveReport(payload.data.report)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load the saved report.')
    } finally {
      setLoadingReportId(null)
    }
  }

  useEffect(() => {
    let mounted = true
    async function loadWorkspace() {
      try {
        const [baselineResponse, reportResponse] = await Promise.all([
          fetch('/api/financial-analysis/baselines'),
          fetch('/api/financial-analysis'),
        ])
        const baselinePayload = await baselineResponse.json() as ApiResponse<{ baselines: FinancialAnalysisBaselineOption[] }>
        const reportPayload = await reportResponse.json() as ApiResponse<{ reports: FinancialAnalysisRunSummary[] }>
        if (!baselineResponse.ok || !baselinePayload.success) {
          throw new Error(baselinePayload.error?.message ?? 'Could not load financial sources.')
        }
        if (!reportResponse.ok || !reportPayload.success) {
          throw new Error(reportPayload.error?.message ?? 'Could not load saved reports.')
        }
        if (!mounted) return
        const loadedReports = reportPayload.data?.reports ?? []
        setBaselines(baselinePayload.data?.baselines ?? [])
        setReports(loadedReports)
        if (loadedReports[0]) await loadReport(loadedReports[0].id)
      } catch (loadError) {
        if (mounted) setError(loadError instanceof Error ? loadError.message : 'Could not load financial analysis.')
      } finally {
        if (mounted) setLoading(false)
      }
    }
    void loadWorkspace()
    return () => { mounted = false }
  }, [])

  async function runAnalysis() {
    if (selectionMode === 'single' && !selectedBaseline) return
    if (
      selectionMode === 'timeline' &&
      (!timelinePreview || !allTimelineConflictsResolved)
    ) return
    setRunning(true)
    setError(null)
    try {
      const response = await fetch('/api/financial-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(selectionMode === 'single'
          ? {
              sourceKey: selectedBaseline?.sourceKey,
              currency: selectedBaseline?.currency,
            }
          : {
              mode: 'timeline',
              sourceKeys: timelineSourceKeys,
              currency: timelineCurrency,
              asOfDate: timelinePreview?.suggestedLatestDate,
              conflictResolutions,
            }),
      })
      const payload = await response.json() as ApiResponse<{ report: FinancialAnalysisRunView }>
      if (!response.ok || !payload.success || !payload.data?.report) {
        throw new Error(payload.error?.message ?? 'Could not run the financial analysis.')
      }
      const report = payload.data.report
      setActiveReport(report)
      setReports((current) => [report, ...current.filter((item) => item.id !== report.id)].slice(0, 20))
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : 'Could not run the financial analysis.')
    } finally {
      setRunning(false)
    }
  }

  if (loading) {
    return <Stack alignItems="center" sx={{ py: 12 }}><CircularProgress aria-label="Loading financial analysis" /></Stack>
  }

  return (
    <Stack spacing={3}>
      <Stack className="analysis-screen-only" spacing={0.75}>
        <Typography variant="h4">Full financial analysis</Typography>
        <Typography sx={{ color: dashboardTokens.textMuted }}>
          Analyse one verified statement or an explicitly reviewed 2–12 statement timeline. Different currencies are never combined or converted.
        </Typography>
      </Stack>

      {error ? <Alert className="analysis-screen-only" severity="error">{error}</Alert> : null}

      <Paper className="analysis-screen-only" variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, borderColor: dashboardTokens.border }}>
        <Stack spacing={2}>
          <FormControl sx={{ maxWidth: 360 }}>
            <InputLabel id="analysis-mode-label">Analysis mode</InputLabel>
            <Select
              labelId="analysis-mode-label"
              label="Analysis mode"
              value={selectionMode}
              onChange={(event) => {
                setSelectionMode(event.target.value as 'single' | 'timeline')
                clearTimelinePreview()
              }}
            >
              <MenuItem value="single">Single statement</MenuItem>
              <MenuItem value="timeline">Statement timeline</MenuItem>
            </Select>
          </FormControl>

          {selectionMode === 'single' ? (
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
              <FormControl fullWidth>
                <InputLabel id="analysis-baseline-label">Source and currency</InputLabel>
                <Select
                  labelId="analysis-baseline-label"
                  label="Source and currency"
                  value={selectedIndex}
                  onChange={(event) => setSelectedIndex(event.target.value)}
                >
                  <MenuItem value=""><em>Select a verified baseline</em></MenuItem>
                  {baselines.map((baseline, index) => (
                    <MenuItem key={`${baseline.sourceKey}-${baseline.currency}`} value={String(index)}>
                      {baseline.sourceLabel} · {baseline.currency} · latest {formatDate(baseline.latestReportingDate)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Button
                variant="contained"
                size="large"
                startIcon={running ? <CircularProgress size={16} color="inherit" /> : <PlayArrowRoundedIcon />}
                disabled={!selectedBaseline || running}
                onClick={() => void runAnalysis()}
                sx={{ minWidth: 190, whiteSpace: 'nowrap' }}
              >
                {running ? 'Running analysis…' : 'Run new analysis'}
              </Button>
            </Stack>
          ) : (
            <Stack spacing={2}>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                <FormControl sx={{ minWidth: 150 }}>
                  <InputLabel id="analysis-timeline-currency-label">Currency</InputLabel>
                  <Select
                    labelId="analysis-timeline-currency-label"
                    label="Currency"
                    value={timelineCurrency}
                    onChange={(event) => {
                      setTimelineCurrency(event.target.value as 'NZD' | 'AUD')
                      setTimelineSourceKeys([])
                      clearTimelinePreview()
                    }}
                  >
                    <MenuItem value="NZD">NZD</MenuItem>
                    <MenuItem value="AUD">AUD</MenuItem>
                  </Select>
                </FormControl>
                <FormControl fullWidth>
                  <InputLabel id="analysis-timeline-sources-label">Statements</InputLabel>
                  <Select
                    multiple
                    labelId="analysis-timeline-sources-label"
                    label="Statements"
                    value={timelineSourceKeys}
                    onChange={(event) => {
                      const value = event.target.value
                      setTimelineSourceKeys(
                        (typeof value === 'string' ? value.split(',') : value).slice(0, 12)
                      )
                      clearTimelinePreview()
                    }}
                    renderValue={(selected) => `${selected.length} statement${selected.length === 1 ? '' : 's'} selected`}
                  >
                    {compatibleTimelineBaselines.map((baseline) => (
                      <MenuItem key={baseline.sourceKey} value={baseline.sourceKey}>
                        {timelineSourceKeys.includes(baseline.sourceKey) ? '✓ ' : ''}
                        {baseline.sourceLabel} · {formatReportingDate(baseline.latestReportingDate)}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Stack>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                <Button
                  variant="outlined"
                  disabled={compatibleTimelineBaselines.length < 2}
                  onClick={selectCompatibleLastSixMonths}
                >
                  Select compatible last six months
                </Button>
                <Button
                  variant="outlined"
                  disabled={timelineSourceKeys.length < 2 || previewing}
                  onClick={() => void previewTimeline()}
                >
                  {previewing ? 'Building preview…' : 'Review timeline'}
                </Button>
                <Button
                  variant="contained"
                  startIcon={running ? <CircularProgress size={16} color="inherit" /> : <PlayArrowRoundedIcon />}
                  disabled={!timelinePreview || !allTimelineConflictsResolved || running}
                  onClick={() => void runAnalysis()}
                >
                  {running ? 'Running analysis…' : 'Run timeline analysis'}
                </Button>
              </Stack>

              {timelinePreview ? (
                <Paper variant="outlined" sx={{ p: 2, borderColor: dashboardTokens.borderSoft }}>
                  <Stack spacing={1.5}>
                    <Typography fontWeight={650}>
                      Timeline preview through {formatReportingDate(timelinePreview.suggestedLatestDate)}
                    </Typography>
                    <Typography variant="body2" sx={{ color: dashboardTokens.textMuted }}>
                      {timelinePreview.reportingDates.length} reporting date{timelinePreview.reportingDates.length === 1 ? '' : 's'} · {timelinePreview.selectedSources.length} sources · {timelinePreview.currency}
                    </Typography>
                    <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                      {timelinePreview.selectedSources.map((source) => (
                        <Chip
                          key={source.sourceKey}
                          size="small"
                          variant="outlined"
                          label={`${source.sourceLabel} · ${source.sourceType}`}
                        />
                      ))}
                    </Stack>
                    {timelinePreview.warnings.map((warning) => (
                      <Alert key={warning} severity="warning">{warning}</Alert>
                    ))}
                    <TableContainer>
                      <Table size="small" aria-label="Timeline metric coverage">
                        <TableHead><TableRow><TableCell>Date</TableCell><TableCell>Available metrics</TableCell><TableCell>Sources</TableCell></TableRow></TableHead>
                        <TableBody>
                          {timelinePreview.metricCoverage.map((item) => (
                            <TableRow key={item.reportingDate}>
                              <TableCell>{formatReportingDate(item.reportingDate)}</TableCell>
                              <TableCell>{item.metricKeys.map((key) => METRIC_LABELS[key]).join(', ') || 'None'}</TableCell>
                              <TableCell>{item.sourceKeys.length}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                    {timelinePreview.conflicts.map((conflict) => (
                      <FormControl key={conflict.conflictId} fullWidth>
                        <InputLabel id={`conflict-${conflict.conflictId}`}>
                          Resolve {METRIC_LABELS[conflict.metricKey]} on {formatReportingDate(conflict.reportingDate)}
                        </InputLabel>
                        <Select
                          labelId={`conflict-${conflict.conflictId}`}
                          label={`Resolve ${METRIC_LABELS[conflict.metricKey]} on ${formatReportingDate(conflict.reportingDate)}`}
                          value={conflictResolutions[conflict.conflictId] ?? ''}
                          onChange={(event) => setConflictResolutions((current) => ({
                            ...current,
                            [conflict.conflictId]: event.target.value,
                          }))}
                        >
                          {conflict.options.map((option) => (
                            <MenuItem key={option.observationId} value={option.observationId}>
                              {option.sourceLabel} · {formatAmount(option.value, timelineCurrency)} · confidence {(option.confidence * 100).toFixed(0)}%
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    ))}
                    <Typography variant="caption" sx={{ color: dashboardTokens.textSubtle }}>
                      The latest selected reporting date becomes the report date. Missing latest-period values remain unavailable; older values are not carried forward.
                    </Typography>
                  </Stack>
                </Paper>
              ) : null}
            </Stack>
          )}
        </Stack>
        {selectionMode === 'single' && selectedBaseline ? (
          <Typography variant="caption" sx={{ display: 'block', mt: 1.25, color: dashboardTokens.textSubtle }}>
            {selectedBaseline.observationCount} observations · {selectedBaseline.availableMetricKeys.map((key) => METRIC_LABELS[key]).join(', ')}
          </Typography>
        ) : null}
        {baselines.length === 0 ? (
          <Alert severity="info" sx={{ mt: 2 }}>
            No verified financial observations are available. <Link href="/dashboard/documents">Review a financial document</Link> first.
          </Alert>
        ) : null}
      </Paper>

      <Box className="analysis-report-layout" sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '280px minmax(0, 1fr)' }, gap: 3, alignItems: 'start' }}>
        <Paper className="analysis-screen-only" variant="outlined" sx={{ p: 1.5, borderColor: dashboardTokens.border }}>
          <Typography fontWeight={650} sx={{ px: 1, py: 0.75 }}>Saved reports</Typography>
          <Divider sx={{ my: 1 }} />
          {reports.length === 0 ? (
            <Typography variant="body2" sx={{ p: 1, color: dashboardTokens.textMuted }}>No reports have been run yet.</Typography>
          ) : (
            <Stack spacing={0.5}>
              {reports.map((report) => (
                <Button
                  key={report.id}
                  onClick={() => void loadReport(report.id)}
                  disabled={loadingReportId === report.id}
                  sx={{
                    display: 'block',
                    textAlign: 'left',
                    px: 1.25,
                    py: 1,
                    color: dashboardTokens.text,
                    bgcolor: activeReport?.id === report.id ? dashboardTokens.surfaceAlt : 'transparent',
                    textTransform: 'none',
                  }}
                >
                  <Typography variant="body2" fontWeight={650} noWrap>{report.selectedSourceLabel}</Typography>
                  <Typography variant="caption" sx={{ color: dashboardTokens.textMuted }}>
                    {report.selectedCurrency} · {formatDate(report.createdAt)}
                  </Typography>
                </Button>
              ))}
            </Stack>
          )}
        </Paper>

        <Box sx={{ minWidth: 0 }}>
          {loadingReportId ? (
            <Stack alignItems="center" sx={{ py: 8 }}><CircularProgress aria-label="Loading saved report" /></Stack>
          ) : activeReport ? (
            <ReportView key={activeReport.id} report={activeReport} />
          ) : (
            <Paper variant="outlined" sx={{ p: 5, textAlign: 'center', borderColor: dashboardTokens.border }}>
              <Typography variant="h6">Choose a source to create your first report</Typography>
              <Typography variant="body2" sx={{ mt: 1, color: dashboardTokens.textMuted }}>
                The analysis will preserve its evidence, policy results, and processing trace as an immutable snapshot.
              </Typography>
            </Paper>
          )}
        </Box>
      </Box>
    </Stack>
  )
}
