'use client'

import {
  Alert,
  Box,
  Button,
  Chip,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { dashboardTokens } from '@/app/theme'
import {
  ANALYSIS_REPORT_METRIC_KEYS,
  buildAnalysisReportMetricSeries,
  type AnalysisReportMetricKey,
} from '@/lib/financial-analysis/report-series'
import type {
  FinancialForecastFact,
  FinancialTrendFact,
} from '@/lib/financial-analysis/types'

const METRIC_PRESENTATION: Record<AnalysisReportMetricKey, {
  label: string
  color: string
}> = {
  cash: { label: 'Cash', color: '#60a5fa' },
  monthly_revenue: { label: 'Monthly revenue', color: '#34d399' },
  monthly_expenses: { label: 'Monthly expenses', color: '#f59e0b' },
  burn_rate: { label: 'Burn rate', color: '#f87171' },
}

function formatAmount(value: number, currency: 'NZD' | 'AUD') {
  return new Intl.NumberFormat('en-NZ', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value)
}

function formatCompactAmount(value: number) {
  return new Intl.NumberFormat('en-NZ', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)
}

function formatPeriod(value: string) {
  return new Intl.DateTimeFormat('en-NZ', {
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${value.slice(0, 7)}-01T00:00:00.000Z`))
}

function trendColor(direction: FinancialTrendFact['direction']) {
  if (direction === 'improving') return dashboardTokens.positive
  if (direction === 'worsening') return dashboardTokens.warning
  return dashboardTokens.textMuted
}

function MetricSummary(props: {
  label: string
  value: string
}) {
  return (
    <Box sx={{ p: 1.5, border: '1px solid', borderColor: dashboardTokens.border, borderRadius: 2 }}>
      <Typography variant="caption" sx={{ color: dashboardTokens.textMuted }}>{props.label}</Typography>
      <Typography fontWeight={700} sx={{ mt: 0.25 }}>{props.value}</Typography>
    </Box>
  )
}

function AnalysisMetricForecastCard(props: {
  metricKey: AnalysisReportMetricKey
  history: FinancialTrendFact | null
  forecast: FinancialForecastFact | null
  currency: 'NZD' | 'AUD'
  onViewEvidence: (metricKey: AnalysisReportMetricKey, label: string) => void
}) {
  const presentation = METRIC_PRESENTATION[props.metricKey]
  const series = buildAnalysisReportMetricSeries({
    history: props.history,
    forecast: props.forecast,
  })
  const latestActual = props.history?.latestValue ?? null
  const finalForecast = props.forecast?.values.at(-1)?.value ?? null
  const monthlySlope = props.forecast?.monthlySlope ?? null

  return (
    <Paper
      className="analysis-report-section analysis-metric-forecast"
      variant="outlined"
      sx={{ p: { xs: 2, sm: 2.5 }, borderColor: dashboardTokens.border }}
    >
      <Stack spacing={2}>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1}>
          <Box>
            <Typography variant="h6">{presentation.label}</Typography>
            <Typography variant="body2" sx={{ color: dashboardTokens.textMuted }}>
              Recorded history followed by a six-month date-aware linear estimate.
            </Typography>
          </Box>
          {props.history ? (
            <Chip
              size="small"
              label={props.history.direction.replaceAll('_', ' ')}
              variant="outlined"
              sx={{ alignSelf: 'flex-start', color: trendColor(props.history.direction), borderColor: trendColor(props.history.direction) }}
            />
          ) : null}
        </Stack>

        <Button
          className="analysis-screen-only"
          size="small"
          onClick={() => props.onViewEvidence(props.metricKey, presentation.label)}
          aria-label={`View evidence for ${presentation.label}`}
          sx={{ alignSelf: 'flex-start', px: 0, minWidth: 0, textTransform: 'none' }}
        >
          View evidence
        </Button>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 1 }}>
          <MetricSummary
            label="Latest recorded"
            value={latestActual === null ? 'Unavailable' : formatAmount(latestActual, props.currency)}
          />
          <MetricSummary
            label="Final six-month estimate"
            value={finalForecast === null ? 'Unavailable' : formatAmount(finalForecast, props.currency)}
          />
          <MetricSummary
            label="Estimated monthly movement"
            value={monthlySlope === null
              ? 'Unavailable'
              : `${monthlySlope >= 0 ? '+' : '−'}${formatAmount(Math.abs(monthlySlope), props.currency)}`}
          />
        </Box>

        {series.chartPoints.length === 0 ? (
          <Alert severity="info">No compatible recorded history is available for this metric.</Alert>
        ) : (
          <Box
            role="img"
            aria-label={`${presentation.label} actual values and six-month forecast`}
            sx={{ width: '100%', minWidth: 0, height: { xs: 280, sm: 320 } }}
          >
            <ResponsiveContainer
              width="100%"
              height="100%"
              minWidth={0}
              initialDimension={{ width: 900, height: 320 }}
            >
              <LineChart data={series.chartPoints} margin={{ top: 20, right: 24, left: 12, bottom: 24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={dashboardTokens.border} />
                <XAxis
                  dataKey="period"
                  stroke={dashboardTokens.textMuted}
                  style={{ fontSize: '0.75rem' }}
                  tickFormatter={formatPeriod}
                />
                <YAxis
                  width={68}
                  stroke={dashboardTokens.textMuted}
                  style={{ fontSize: '0.75rem' }}
                  tickFormatter={(value) => formatCompactAmount(Number(value))}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: dashboardTokens.surfaceAlt,
                    border: `1px solid ${dashboardTokens.border}`,
                    borderRadius: 8,
                    color: dashboardTokens.text,
                  }}
                  labelFormatter={(value) => formatPeriod(String(value))}
                  formatter={(value, name) => [
                    formatAmount(Number(value), props.currency),
                    name === 'actual' ? 'Recorded' : 'Forecast',
                  ]}
                />
                {series.forecastStartPeriod ? (
                  <ReferenceLine
                    x={series.forecastStartPeriod}
                    stroke={dashboardTokens.textMuted}
                    strokeDasharray="3 3"
                    label={{ value: 'Forecast begins', position: 'insideTopRight', fill: dashboardTokens.textMuted, fontSize: 12 }}
                  />
                ) : null}
                <Line
                  type="monotone"
                  dataKey="actual"
                  name="actual"
                  stroke={presentation.color}
                  strokeWidth={3}
                  dot={{ fill: presentation.color, r: 4 }}
                  activeDot={{ r: 6 }}
                  connectNulls={false}
                />
                <Line
                  type="monotone"
                  dataKey="forecast"
                  name="forecast"
                  stroke="#fbbf24"
                  strokeWidth={3}
                  strokeDasharray="7 5"
                  dot={{ fill: '#fbbf24', r: 4 }}
                  activeDot={{ r: 6 }}
                  connectNulls={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </Box>
        )}

        <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
          <Stack direction="row" spacing={0.75} alignItems="center">
            <Box sx={{ width: 24, borderTop: `3px solid ${presentation.color}` }} />
            <Typography variant="caption">Recorded</Typography>
          </Stack>
          <Stack direction="row" spacing={0.75} alignItems="center">
            <Box sx={{ width: 24, borderTop: '3px dashed #fbbf24' }} />
            <Typography variant="caption">Forecast estimate</Typography>
          </Stack>
        </Stack>

        <TableContainer sx={{ border: '1px solid', borderColor: dashboardTokens.border, borderRadius: 2 }}>
          <Table size="small" aria-label={`${presentation.label} history and forecast values`}>
            <TableHead>
              <TableRow>
                <TableCell>Period</TableCell>
                <TableCell>Value type</TableCell>
                <TableCell align="right">Value</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {series.tableRows.map((row) => (
                <TableRow key={`${row.phase}-${row.period}`}>
                  <TableCell>{formatPeriod(row.period)}</TableCell>
                  <TableCell>{row.phase}</TableCell>
                  <TableCell align="right">{formatAmount(row.value, props.currency)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        <Typography variant="caption" sx={{ color: dashboardTokens.textSubtle }}>
          Forecast values continue the observed date-aware linear trend. They do not account for causation, seasonality or future events and are not guarantees.
        </Typography>
      </Stack>
    </Paper>
  )
}

export function AnalysisTrendForecastSection(props: {
  history: FinancialTrendFact[]
  forecasts: FinancialForecastFact[]
  currency: 'NZD' | 'AUD'
  onViewEvidence: (metricKey: AnalysisReportMetricKey, label: string) => void
}) {
  return (
    <Stack spacing={2}>
      <Box className="analysis-report-section">
        <Typography variant="h5">History and six-month forecast</Typography>
        <Typography variant="body2" sx={{ mt: 0.5, color: dashboardTokens.textMuted }}>
          Every supported forecast metric is shown below. NZD and AUD are never combined or converted.
        </Typography>
      </Box>
      {ANALYSIS_REPORT_METRIC_KEYS.map((metricKey) => (
        <AnalysisMetricForecastCard
          key={metricKey}
          metricKey={metricKey}
          history={props.history.find((fact) => fact.metricKey === metricKey) ?? null}
          forecast={props.forecasts.find((fact) => fact.metricKey === metricKey) ?? null}
          currency={props.currency}
          onViewEvidence={props.onViewEvidence}
        />
      ))}
    </Stack>
  )
}
