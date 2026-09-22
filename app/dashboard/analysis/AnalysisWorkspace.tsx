'use client'

import { useEffect, useMemo, useState } from 'react'
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
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded'
import { dashboardTokens } from '@/app/theme'
import type { FinancialAnalysisBaselineOption } from '@/lib/financial-analysis/baselines'
import type {
  FinancialAnalysisRunSummary,
  FinancialAnalysisRunView,
} from '@/lib/financial-analysis/persistence'
import type {
  FinancialTrendFact,
} from '@/lib/financial-analysis/types'

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

function MetricCard(props: { label: string; value: string; detail: string }) {
  return (
    <Paper variant="outlined" sx={{ p: 2, minWidth: 0, borderColor: dashboardTokens.border }}>
      <Typography variant="caption" sx={{ color: dashboardTokens.textMuted }}>{props.label}</Typography>
      <Typography variant="h5" sx={{ mt: 0.5 }}>{props.value}</Typography>
      <Typography variant="caption" sx={{ color: dashboardTokens.textSubtle }}>{props.detail}</Typography>
    </Paper>
  )
}

function TrendTable(props: {
  trend: FinancialTrendFact
  currency: 'NZD' | 'AUD'
}) {
  return (
    <TableContainer>
      <Table size="small" aria-label={`${METRIC_LABELS[props.trend.metricKey]} history`}>
        <TableHead><TableRow><TableCell>Date</TableCell><TableCell align="right">Value</TableCell></TableRow></TableHead>
        <TableBody>
          {props.trend.values.map((point) => (
            <TableRow key={point.date}>
              <TableCell>{formatDate(point.date)}</TableCell>
              <TableCell align="right">{formatAmount(point.value, props.currency)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  )
}

function ReportView({ report }: { report: FinancialAnalysisRunView }) {
  const result = report.result
  const { currency } = result.selectedBaseline
  const runway = result.facts.runway
  const operatingBalance = result.facts.operatingBalance
  const workingCapital = result.facts.receivablesPayables

  return (
    <Stack spacing={2.5}>
      <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, borderColor: dashboardTokens.border }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={2}>
          <Stack spacing={0.75}>
            <Typography variant="overline" sx={{ color: dashboardTokens.textMuted }}>Financial analysis</Typography>
            <Typography variant="h4">{result.selectedBaseline.sourceLabel}</Typography>
            <Typography variant="body2" sx={{ color: dashboardTokens.textMuted }}>
              {currency} · Generated {formatDate(report.createdAt)}
            </Typography>
          </Stack>
          <Stack direction="row" spacing={1} alignItems="flex-start" flexWrap="wrap" useFlexGap>
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

      <Panel title="Executive summary">
        <Typography sx={{ color: dashboardTokens.textSoft }}>{result.narrative.executiveSummary}</Typography>
      </Panel>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 2 }}>
        <MetricCard
          label="Current cash runway"
          value={runway ? `${runway.cashRunwayMonths.toFixed(1)} months` : 'Unavailable'}
          detail={runway ? `${formatAmount(runway.cash, currency)} cash at ${formatAmount(runway.monthlyBurnRate, currency)} monthly burn` : 'Compatible cash and burn-rate observations are required.'}
        />
        <MetricCard
          label="Monthly operating balance"
          value={operatingBalance ? formatAmount(operatingBalance.operatingBalance, currency) : 'Unavailable'}
          detail={operatingBalance ? `${formatAmount(operatingBalance.monthlyRevenue, currency)} revenue less ${formatAmount(operatingBalance.monthlyExpenses, currency)} expenses` : 'Compatible revenue and expense observations are required.'}
        />
        <MetricCard
          label="Receivables less payables"
          value={workingCapital ? formatAmount(workingCapital.netPosition, currency) : 'Unavailable'}
          detail={workingCapital ? `${formatAmount(workingCapital.accountsReceivable, currency)} receivable and ${formatAmount(workingCapital.accountsPayable, currency)} payable` : 'Compatible receivable and payable observations are required.'}
        />
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 2 }}>
        <Panel title="Financial position">
          <Typography sx={{ color: dashboardTokens.textSoft }}>{result.narrative.financialPosition}</Typography>
        </Panel>
        <Panel title="Trend and forecast">
          <Typography sx={{ color: dashboardTokens.textSoft }}>{result.narrative.trendAndForecast}</Typography>
        </Panel>
      </Box>

      <Panel title="Six-month history">
        {result.facts.history.length === 0 ? (
          <Typography sx={{ color: dashboardTokens.textMuted }}>No compatible history is available.</Typography>
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, 1fr)' }, gap: 2 }}>
            {result.facts.history.map((trend) => (
              <Box key={trend.metricKey} sx={{ border: '1px solid', borderColor: dashboardTokens.border, borderRadius: 2, overflow: 'hidden' }}>
                <Stack direction="row" justifyContent="space-between" sx={{ p: 1.5 }}>
                  <Typography fontWeight={650}>{METRIC_LABELS[trend.metricKey]}</Typography>
                  <Chip size="small" label={trend.direction.replaceAll('_', ' ')} />
                </Stack>
                <TrendTable trend={trend} currency={currency} />
              </Box>
            ))}
          </Box>
        )}
      </Panel>

      <Panel title="Six-month deterministic forecast">
        {result.facts.forecasts.length === 0 ? (
          <Typography sx={{ color: dashboardTokens.textMuted }}>At least two dated observations are required for a trend forecast.</Typography>
        ) : (
          <TableContainer>
            <Table size="small" aria-label="Six-month financial forecast">
              <TableHead><TableRow><TableCell>Metric</TableCell><TableCell>Month</TableCell><TableCell align="right">Estimated value</TableCell></TableRow></TableHead>
              <TableBody>
                {result.facts.forecasts.flatMap((forecast) => forecast.values.map((point) => (
                  <TableRow key={`${forecast.metricKey}-${point.month}`}>
                    <TableCell>{METRIC_LABELS[forecast.metricKey]}</TableCell>
                    <TableCell>{point.month}</TableCell>
                    <TableCell align="right">{formatAmount(point.value, currency)}</TableCell>
                  </TableRow>
                )))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
        <Typography variant="caption" sx={{ display: 'block', mt: 1.5, color: dashboardTokens.textSubtle }}>
          Trend estimates are based on recorded observations and are not guarantees.
        </Typography>
      </Panel>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 2 }}>
        <Panel title="Risks and policy">
          <Stack spacing={1.5}>
            {result.narrative.risks.map((risk) => <Typography key={risk}>• {risk}</Typography>)}
            <Divider />
            {result.policy.rules.map((rule) => (
              <Stack key={rule.ruleId} direction="row" spacing={1} alignItems="flex-start">
                <Chip size="small" label={rule.status.replaceAll('_', ' ')} sx={{ color: statusColor(rule.status) }} />
                <Typography variant="body2" sx={{ color: dashboardTokens.textSoft }}>{rule.message}</Typography>
              </Stack>
            ))}
          </Stack>
        </Panel>
        <Panel title="Recommended next actions">
          <Stack spacing={1.5}>
            {result.recommendations.map((recommendation) => (
              <Box key={recommendation.id}>
                <Typography fontWeight={650}>{recommendation.priority}. {METRIC_LABELS[recommendation.id] ?? recommendation.id.replaceAll('_', ' ')}</Typography>
                <Typography variant="body2" sx={{ color: dashboardTokens.textMuted }}>{recommendation.reason}</Typography>
              </Box>
            ))}
          </Stack>
        </Panel>
      </Box>

      <Accordion variant="outlined">
        <AccordionSummary expandIcon={<ExpandMoreRoundedIcon />}><Typography fontWeight={650}>Readiness and limitations</Typography></AccordionSummary>
        <AccordionDetails>
          <Stack spacing={1}>
            {result.readiness.reasons.map((reason) => <Typography key={reason}>• {reason}</Typography>)}
            {result.narrative.limitations.map((item) => <Typography key={item}>• {item}</Typography>)}
            {result.assumptions.map((item) => <Typography key={item}>• {item}</Typography>)}
          </Stack>
        </AccordionDetails>
      </Accordion>

      <Accordion variant="outlined">
        <AccordionSummary expandIcon={<ExpandMoreRoundedIcon />}><Typography fontWeight={650}>Evidence and processing trace</Typography></AccordionSummary>
        <AccordionDetails>
          <Stack spacing={2}>
            <TableContainer>
              <Table size="small" aria-label="Financial analysis evidence">
                <TableHead><TableRow><TableCell>Metric</TableCell><TableCell>Date</TableCell><TableCell align="right">Value</TableCell><TableCell>Source</TableCell></TableRow></TableHead>
                <TableBody>
                  {result.evidence.map((item) => (
                    <TableRow key={item.observationId}>
                      <TableCell>{METRIC_LABELS[item.metricKey]}</TableCell>
                      <TableCell>{formatDate(item.reportingDate)}</TableCell>
                      <TableCell align="right">{formatAmount(item.value, currency)}</TableCell>
                      <TableCell>{item.sourceLabel}</TableCell>
                    </TableRow>
                  ))}
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
    </Stack>
  )
}

export function AnalysisWorkspace() {
  const [baselines, setBaselines] = useState<FinancialAnalysisBaselineOption[]>([])
  const [reports, setReports] = useState<FinancialAnalysisRunSummary[]>([])
  const [selectedIndex, setSelectedIndex] = useState('')
  const [activeReport, setActiveReport] = useState<FinancialAnalysisRunView | null>(null)
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [loadingReportId, setLoadingReportId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const selectedBaseline = useMemo(
    () => selectedIndex === '' ? null : baselines[Number(selectedIndex)] ?? null,
    [baselines, selectedIndex]
  )

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
    if (!selectedBaseline) return
    setRunning(true)
    setError(null)
    try {
      const response = await fetch('/api/financial-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceKey: selectedBaseline.sourceKey,
          currency: selectedBaseline.currency,
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
      <Stack spacing={0.75}>
        <Typography variant="h4">Full financial analysis</Typography>
        <Typography sx={{ color: dashboardTokens.textMuted }}>
          Review one verified source and currency at a time. Different currencies are never combined or converted.
        </Typography>
      </Stack>

      {error ? <Alert severity="error">{error}</Alert> : null}

      <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, borderColor: dashboardTokens.border }}>
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
        {selectedBaseline ? (
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

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '280px minmax(0, 1fr)' }, gap: 3, alignItems: 'start' }}>
        <Paper variant="outlined" sx={{ p: 1.5, borderColor: dashboardTokens.border }}>
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
            <ReportView report={activeReport} />
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
