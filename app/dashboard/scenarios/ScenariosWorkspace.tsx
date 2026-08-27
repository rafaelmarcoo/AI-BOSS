'use client'

import { useEffect, useMemo, useState } from 'react'
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
  TextField,
  Typography,
} from '@mui/material'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded'
import { dashboardTokens } from '@/app/theme'
import { GenUiWidgetRenderer } from '@/app/dashboard/runway/gen-ui/GenUiCanvas'
import { addScenarioMonths } from '@/lib/scenarios/calculation'
import type { ScenarioAnalysisResult } from '@/lib/scenarios/calculation'
import type {
  ScenarioAdjustment,
  ScenarioAnalysisInput,
  ScenarioDefinition,
} from '@/lib/scenarios/schema'
import type { ScenarioBaselineOption } from '@/lib/scenarios/service'
import type { SavedScenario, ScenarioVisibility } from '@/types/database'

interface BaselineResponse {
  success: boolean
  data?: { baselines: ScenarioBaselineOption[] }
  error?: { message?: string }
}

interface AnalysisResponse {
  success: boolean
  data?: { result: ScenarioAnalysisResult }
  error?: { message?: string }
}

interface SavedScenarioView extends SavedScenario {
  isOwner: boolean
  isStale: boolean | null
}

interface SavedScenarioResponse {
  success: boolean
  data?: { scenario?: SavedScenarioView; scenarios?: SavedScenarioView[] }
  error?: { message?: string }
}

function createId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`
}

function nextMonthFromDate(date: string | null) {
  if (!date) return ''
  return addScenarioMonths(date.slice(0, 7), 1)
}

function emptyAdjustment(startMonth: string): ScenarioAdjustment {
  return {
    id: createId('adjustment'),
    label: 'New adjustment',
    kind: 'fixed',
    flow: 'outflow',
    frequency: 'recurring',
    amount: 0,
    startMonth,
  }
}

function emptyScenario(startMonth: string, number: number): ScenarioDefinition {
  return {
    id: createId('scenario'),
    label: `Scenario ${number}`,
    adjustments: [emptyAdjustment(startMonth)],
  }
}

function scenarioMonths(startMonth: string, horizon: number) {
  if (!startMonth) return []
  return Array.from({ length: horizon }, (_, index) => addScenarioMonths(startMonth, index))
}

export function ScenariosWorkspace() {
  const [baselines, setBaselines] = useState<ScenarioBaselineOption[]>([])
  const [baselinesLoading, setBaselinesLoading] = useState(true)
  const [selectedKey, setSelectedKey] = useState('')
  const [input, setInput] = useState<ScenarioAnalysisInput | null>(null)
  const [result, setResult] = useState<ScenarioAnalysisResult | null>(null)
  const [dirty, setDirty] = useState(false)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedScenarios, setSavedScenarios] = useState<SavedScenarioView[]>([])
  const [libraryLoading, setLibraryLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editingScenarioId, setEditingScenarioId] = useState<string | null>(null)
  const [savedName, setSavedName] = useState('')
  const [savedDescription, setSavedDescription] = useState('')
  const [savedVisibility, setSavedVisibility] = useState<ScenarioVisibility>('private')
  const [loadedScenario, setLoadedScenario] = useState<SavedScenarioView | null>(null)
  const [resultChanged, setResultChanged] = useState(false)

  useEffect(() => {
    let mounted = true
    async function load() {
      try {
        const response = await fetch('/api/scenarios/baselines')
        const payload = await response.json() as BaselineResponse
        if (!response.ok || !payload.success) throw new Error(payload.error?.message ?? 'Could not load scenario baselines.')
        if (!mounted) return
        const options = payload.data?.baselines ?? []
        setBaselines(options)

        const saved = window.sessionStorage.getItem('ai-boss-scenario-draft')
        if (saved) {
          window.sessionStorage.removeItem('ai-boss-scenario-draft')
          const draft = JSON.parse(saved) as { input?: ScenarioAnalysisInput; result?: ScenarioAnalysisResult }
          if (draft.input) {
            setInput(draft.input)
            setResult(draft.result ?? null)
            setSelectedKey(`${draft.input.sourceKey}|${draft.input.currency}`)
            return
          }
        }

        if (options.length === 1) selectBaseline(options[0], true)
      } catch (loadError) {
        if (mounted) setError(loadError instanceof Error ? loadError.message : 'Could not load scenario baselines.')
      } finally {
        if (mounted) setBaselinesLoading(false)
      }
    }
    void load()
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    let mounted = true
    async function loadLibrary() {
      try {
        const response = await fetch('/api/scenarios')
        const payload = await response.json() as SavedScenarioResponse
        if (!response.ok || !payload.success) throw new Error(payload.error?.message ?? 'Could not load saved scenarios.')
        if (mounted) setSavedScenarios(payload.data?.scenarios ?? [])
      } catch (loadError) {
        if (mounted) setError(loadError instanceof Error ? loadError.message : 'Could not load saved scenarios.')
      } finally {
        if (mounted) setLibraryLoading(false)
      }
    }
    void loadLibrary()
    return () => { mounted = false }
  }, [])

  const selectedBaseline = baselines.find((option) =>
    `${option.sourceKey}|${option.currency}` === selectedKey
  ) ?? null
  const projectionStartMonth = nextMonthFromDate(
    input?.manualBaseline.asOfMonth
      ? `${input.manualBaseline.asOfMonth}-01`
      : selectedBaseline?.metrics.cash?.reportingDate ?? selectedBaseline?.latestReportingDate ?? null
  )
  const months = useMemo(
    () => scenarioMonths(projectionStartMonth, input?.horizon ?? 6),
    [projectionStartMonth, input?.horizon]
  )

  function selectBaseline(option: ScenarioBaselineOption, resetAssumptions = false) {
    const startMonth = nextMonthFromDate(option.metrics.cash?.reportingDate ?? option.latestReportingDate)
    setSelectedKey(`${option.sourceKey}|${option.currency}`)
    setInput((current) => current && !resetAssumptions
      ? {
          ...current,
          sourceKey: option.sourceKey,
          currency: option.currency,
          manualBaseline: current.currency === option.currency ? current.manualBaseline : {},
        }
      : {
          sourceKey: option.sourceKey,
          currency: option.currency,
          horizon: 6,
          trendRange: '6m',
          manualBaseline: {},
          scenarios: [emptyScenario(startMonth, 1)],
        })
    setResult(null)
    setDirty(true)
    setResultChanged(false)
  }

  function updateInput(update: (current: ScenarioAnalysisInput) => ScenarioAnalysisInput) {
    setInput((current) => current ? update(current) : current)
    setDirty(true)
  }

  function updateScenario(scenarioId: string, update: (scenario: ScenarioDefinition) => ScenarioDefinition) {
    updateInput((current) => ({
      ...current,
      scenarios: current.scenarios.map((scenario) => scenario.id === scenarioId ? update(scenario) : scenario),
    }))
  }

  function updateAdjustment(scenarioId: string, adjustmentId: string, update: (adjustment: ScenarioAdjustment) => ScenarioAdjustment) {
    updateScenario(scenarioId, (scenario) => ({
      ...scenario,
      adjustments: scenario.adjustments.map((adjustment) => adjustment.id === adjustmentId ? update(adjustment) : adjustment),
    }))
  }

  async function runComparison() {
    if (!input) return
    setRunning(true)
    setError(null)
    try {
      const response = await fetch('/api/scenarios/analyse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      const payload = await response.json() as AnalysisResponse
      if (!response.ok || !payload.success || !payload.data?.result) {
        throw new Error(payload.error?.message ?? 'Could not calculate the scenario comparison.')
      }
      setResult(payload.data.result)
      setDirty(false)
      setResultChanged(true)
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : 'Could not calculate the scenario comparison.')
    } finally {
      setRunning(false)
    }
  }

  function openSavedScenario(scenario: SavedScenarioView) {
    const savedInput = scenario.input_payload as ScenarioAnalysisInput
    setInput(savedInput)
    setResult(scenario.result_payload)
    setSelectedKey(savedInput.sourceKey ? `${savedInput.sourceKey}|${savedInput.currency}` : '')
    setEditingScenarioId(scenario.id)
    setSavedName(scenario.name)
    setSavedDescription(scenario.description ?? '')
    setSavedVisibility(scenario.visibility)
    setLoadedScenario(scenario)
    setDirty(false)
    setResultChanged(false)
    setError(null)
  }

  function resetSavedDetails() {
    setEditingScenarioId(null)
    setSavedName(input?.scenarios[0]?.label ?? '')
    setSavedDescription('')
    setSavedVisibility('private')
    setLoadedScenario(null)
  }

  async function refreshLibrary() {
    const response = await fetch('/api/scenarios')
    const payload = await response.json() as SavedScenarioResponse
    if (!response.ok || !payload.success) throw new Error(payload.error?.message ?? 'Could not refresh saved scenarios.')
    setSavedScenarios(payload.data?.scenarios ?? [])
  }

  async function saveScenario(
    status: 'draft' | 'calculated',
    visibility: ScenarioVisibility,
    recalculate: boolean
  ) {
    if (!input || !savedName.trim()) {
      setError('Enter a scenario library name before saving.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const response = await fetch(editingScenarioId ? `/api/scenarios/${editingScenarioId}` : '/api/scenarios', {
        method: editingScenarioId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: savedName,
          description: savedDescription || null,
          status,
          visibility,
          input,
          recalculate,
        }),
      })
      const payload = await response.json() as SavedScenarioResponse
      const saved = payload.data?.scenario
      if (!response.ok || !payload.success || !saved) throw new Error(payload.error?.message ?? 'Could not save the scenario.')
      openSavedScenario(saved)
      await refreshLibrary()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save the scenario.')
    } finally {
      setSaving(false)
    }
  }

  async function duplicateScenario(scenarioId: string) {
    setSaving(true)
    setError(null)
    try {
      const response = await fetch(`/api/scenarios/${scenarioId}/duplicate`, { method: 'POST' })
      const payload = await response.json() as SavedScenarioResponse
      const duplicate = payload.data?.scenario
      if (!response.ok || !payload.success || !duplicate) throw new Error(payload.error?.message ?? 'Could not duplicate the scenario.')
      openSavedScenario(duplicate)
      await refreshLibrary()
    } catch (duplicateError) {
      setError(duplicateError instanceof Error ? duplicateError.message : 'Could not duplicate the scenario.')
    } finally {
      setSaving(false)
    }
  }

  async function deleteScenario(scenarioId: string) {
    if (!window.confirm('Delete this saved scenario? This cannot be undone.')) return
    setSaving(true)
    setError(null)
    try {
      const response = await fetch(`/api/scenarios/${scenarioId}`, { method: 'DELETE' })
      const payload = await response.json() as SavedScenarioResponse
      if (!response.ok || !payload.success) throw new Error(payload.error?.message ?? 'Could not delete the scenario.')
      if (editingScenarioId === scenarioId) resetSavedDetails()
      await refreshLibrary()
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Could not delete the scenario.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Stack spacing={3}>
      <Box>
        <Typography component="h1" variant="h4" fontWeight={700} color="common.white">Scenarios</Typography>
        <Typography sx={{ color: dashboardTokens.textMuted, mt: 0.5 }}>
          Compare deterministic current-run-rate and historical-trend outcomes. Scenario work never changes your uploaded financial observations.
        </Typography>
      </Box>

      {error ? <Alert severity="error" onClose={() => setError(null)}>{error}</Alert> : null}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: 'minmax(0, 1fr)',
            lg: 'minmax(400px, 500px) minmax(0, 1fr)',
            xl: 'minmax(420px, 540px) minmax(0, 1fr)',
          },
          gap: { xs: 3, lg: 2.5 },
          alignItems: 'start',
        }}
      >
        <Stack spacing={2.5} sx={{ minWidth: 0 }}>

      <Paper variant="outlined" sx={{ p: 2.5, bgcolor: dashboardTokens.surface, borderColor: dashboardTokens.border }}>
        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1}>
            <Box>
              <Typography variant="h6" fontWeight={700}>Saved scenario library</Typography>
              <Typography variant="body2" sx={{ color: dashboardTokens.textMuted }}>
                Private drafts belong to you. Calculated scenarios can be shared with your company as frozen results.
              </Typography>
            </Box>
            <Button
              onClick={() => {
                resetSavedDetails()
                if (selectedBaseline) selectBaseline(selectedBaseline, true)
              }}
            >
              New comparison
            </Button>
          </Stack>
          {libraryLoading ? <CircularProgress size={24} /> : savedScenarios.length === 0 ? (
            <Typography variant="body2" sx={{ color: dashboardTokens.textMuted }}>No saved scenarios yet.</Typography>
          ) : (
            <Stack divider={<Divider flexItem />}>
              {savedScenarios.map((scenario) => (
                <Stack key={scenario.id} spacing={1.5} py={1.5}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                      <Typography fontWeight={700}>{scenario.name}</Typography>
                      <Chip size="small" label={scenario.status} />
                      <Chip size="small" color={scenario.visibility === 'company' ? 'info' : 'default'} label={scenario.visibility} />
                      {!scenario.isOwner ? <Chip size="small" label="Shared with you" /> : null}
                      {scenario.isStale ? <Chip size="small" color="warning" label="Source data changed" /> : null}
                    </Stack>
                    {scenario.description ? <Typography variant="body2" sx={{ color: dashboardTokens.textMuted, mt: 0.5 }}>{scenario.description}</Typography> : null}
                  </Box>
                  <Stack direction="row" spacing={1}>
                    <Button size="small" onClick={() => openSavedScenario(scenario)}>Open</Button>
                    <Button size="small" disabled={saving} onClick={() => void duplicateScenario(scenario.id)}>Duplicate</Button>
                    {scenario.isOwner ? <Button size="small" color="error" disabled={saving} onClick={() => void deleteScenario(scenario.id)}>Delete</Button> : null}
                  </Stack>
                </Stack>
              ))}
            </Stack>
          )}
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2.5, bgcolor: dashboardTokens.surface, borderColor: dashboardTokens.border }}>
        <Stack spacing={2.5}>
          <Typography variant="h6" fontWeight={700}>Baseline and timing</Typography>
          {baselinesLoading ? <CircularProgress size={24} /> : baselines.length === 0 ? (
            <Alert severity="info">Upload and confirm a dated NZD or AUD statement before building a source-backed scenario.</Alert>
          ) : (
            <FormControl fullWidth>
              <InputLabel id="scenario-source-label">Source / statement and currency</InputLabel>
              <Select
                labelId="scenario-source-label"
                label="Source / statement and currency"
                value={selectedKey}
                onChange={(event) => {
                  const option = baselines.find((item) => `${item.sourceKey}|${item.currency}` === event.target.value)
                  if (
                    option &&
                    loadedScenario?.status === 'calculated' &&
                    event.target.value !== selectedKey &&
                    !window.confirm(`Change this scenario to ${option.sourceLabel} (${option.currency})? Its stored result will remain unchanged until you run and save a new calculation.`)
                  ) return
                  if (option) selectBaseline(option)
                }}
              >
                {baselines.map((option) => (
                  <MenuItem key={`${option.sourceKey}-${option.currency}`} value={`${option.sourceKey}|${option.currency}`}>
                    {option.sourceLabel} · {option.currency} · latest {option.latestReportingDate ?? 'undated'}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          {input ? (
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr', gap: 2 }}>
              <TextField select label="Planning horizon" value={input.horizon} onChange={(event) => updateInput((current) => ({ ...current, horizon: Number(event.target.value) as ScenarioAnalysisInput['horizon'] }))}>
                {[3, 6, 12, 24].map((value) => <MenuItem key={value} value={value}>{value} months</MenuItem>)}
              </TextField>
              <TextField select label="Historical trend lookback" value={input.trendRange} onChange={(event) => updateInput((current) => ({ ...current, trendRange: event.target.value as ScenarioAnalysisInput['trendRange'] }))}>
                <MenuItem value="3m">Last 3 months</MenuItem><MenuItem value="6m">Last 6 months</MenuItem><MenuItem value="all">All history</MenuItem>
              </TextField>
            </Box>
          ) : null}

          {input && selectedBaseline ? (
            <Accordion disableGutters sx={{ bgcolor: 'transparent', border: '1px solid', borderColor: dashboardTokens.border, '&:before': { display: 'none' } }}>
              <AccordionSummary expandIcon={<ExpandMoreRoundedIcon />}><Typography fontWeight={700}>Manual baseline overrides</Typography></AccordionSummary>
              <AccordionDetails>
                <Alert severity="warning" sx={{ mb: 2 }}>Overrides are unreviewed scenario assumptions. They are never saved as financial observations.</Alert>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' }, gap: 2 }}>
                  {[
                    ['cash', 'Cash', 'cash'], ['accountsReceivable', 'Accounts receivable', 'accounts_receivable'],
                    ['accountsPayable', 'Accounts payable', 'accounts_payable'], ['burnRate', 'Monthly burn', 'burn_rate'],
                    ['monthlyRevenue', 'Monthly revenue', 'monthly_revenue'], ['monthlyExpenses', 'Monthly expenses', 'monthly_expenses'],
                  ].map(([field, label, metricKey]) => (
                    <TextField
                      key={field}
                      type="number"
                      label={`${label} (${input.currency})`}
                      value={input.manualBaseline[field as keyof typeof input.manualBaseline] ?? ''}
                      placeholder={String(selectedBaseline.metrics[metricKey as keyof typeof selectedBaseline.metrics]?.value ?? 'Missing')}
                      onChange={(event) => updateInput((current) => ({
                        ...current,
                        manualBaseline: {
                          ...current.manualBaseline,
                          [field]: event.target.value === '' ? undefined : Number(event.target.value),
                        },
                      }))}
                    />
                  ))}
                  <TextField
                    type="month" label="Manual baseline month" InputLabelProps={{ shrink: true }}
                    value={input.manualBaseline.asOfMonth ?? ''}
                    onChange={(event) => updateInput((current) => ({ ...current, manualBaseline: { ...current.manualBaseline, asOfMonth: event.target.value || undefined } }))}
                    helperText="Required only when manually supplying cash without a dated cash observation."
                  />
                </Box>
              </AccordionDetails>
            </Accordion>
          ) : null}
        </Stack>
      </Paper>

      {input ? (
        <Stack spacing={2}>
          {input.scenarios.map((scenario, scenarioIndex) => (
            <Paper key={scenario.id} variant="outlined" sx={{ p: 2.5, bgcolor: dashboardTokens.surface, borderColor: dashboardTokens.border }}>
              <Stack spacing={2}>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
                  <TextField fullWidth label={`Scenario ${scenarioIndex + 1} name`} value={scenario.label} onChange={(event) => updateScenario(scenario.id, (current) => ({ ...current, label: event.target.value }))} />
                  {input.scenarios.length > 1 ? <Button color="error" startIcon={<DeleteOutlineRoundedIcon />} onClick={() => updateInput((current) => ({ ...current, scenarios: current.scenarios.filter((item) => item.id !== scenario.id) }))}>Remove</Button> : null}
                </Stack>

                {scenario.adjustments.map((adjustment, adjustmentIndex) => (
                  <Box key={adjustment.id} sx={{ p: 2, border: '1px solid', borderColor: dashboardTokens.border, borderRadius: 1 }}>
                    <Stack spacing={2}>
                      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                        <TextField fullWidth label={`Adjustment ${adjustmentIndex + 1}`} value={adjustment.label} onChange={(event) => updateAdjustment(scenario.id, adjustment.id, (current) => ({ ...current, label: event.target.value }))} />
                        <TextField select label="Calculation" value={adjustment.kind} sx={{ minWidth: 170 }} onChange={(event) => {
                          const kind = event.target.value
                          updateAdjustment(scenario.id, adjustment.id, (current) => kind === 'percentage'
                            ? { id: current.id, label: current.label, kind: 'percentage', mode: 'step', metric: 'monthly_revenue', percentageChange: 0, startMonth: current.startMonth, endMonth: current.endMonth }
                            : { id: current.id, label: current.label, kind: 'fixed', flow: 'outflow', frequency: 'recurring', amount: 0, startMonth: current.startMonth, endMonth: current.endMonth })
                        }}><MenuItem value="fixed">Fixed amount</MenuItem><MenuItem value="percentage">Percentage</MenuItem></TextField>
                        {scenario.adjustments.length > 1 ? <Button color="error" onClick={() => updateScenario(scenario.id, (current) => ({ ...current, adjustments: current.adjustments.filter((item) => item.id !== adjustment.id) }))}>Remove</Button> : null}
                      </Stack>

                      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' }, gap: 2 }}>
                        {adjustment.kind === 'fixed' ? <>
                          <TextField select label="Cash flow" value={adjustment.flow} onChange={(event) => updateAdjustment(scenario.id, adjustment.id, (current) => current.kind === 'fixed' ? { ...current, flow: event.target.value as 'inflow' | 'outflow' } : current)}><MenuItem value="inflow">Inflow</MenuItem><MenuItem value="outflow">Outflow</MenuItem></TextField>
                          <TextField select label="Frequency" value={adjustment.frequency} onChange={(event) => updateAdjustment(scenario.id, adjustment.id, (current) => current.kind === 'fixed' ? { ...current, frequency: event.target.value as 'one_off' | 'recurring', ...(event.target.value === 'one_off' ? { endMonth: undefined } : {}) } : current)}><MenuItem value="one_off">One-off</MenuItem><MenuItem value="recurring">Recurring monthly</MenuItem></TextField>
                          <TextField type="number" label={`Amount (${input.currency})`} value={adjustment.amount || ''} onChange={(event) => updateAdjustment(scenario.id, adjustment.id, (current) => current.kind === 'fixed' ? { ...current, amount: Number(event.target.value) } : current)} />
                        </> : <>
                          <TextField select label="Percentage mode" value={adjustment.mode} onChange={(event) => updateAdjustment(scenario.id, adjustment.id, (current) => current.kind === 'percentage' ? { ...current, mode: event.target.value as 'step' | 'compound' } : current)}><MenuItem value="step">Fixed step</MenuItem><MenuItem value="compound">Compound monthly</MenuItem></TextField>
                          <TextField select label="Metric" value={adjustment.metric} onChange={(event) => updateAdjustment(scenario.id, adjustment.id, (current) => current.kind === 'percentage' ? { ...current, metric: event.target.value as typeof current.metric } : current)}><MenuItem value="monthly_revenue">Monthly revenue</MenuItem><MenuItem value="monthly_expenses">Monthly expenses</MenuItem><MenuItem value="burn_rate">Burn rate</MenuItem></TextField>
                          <TextField type="number" label="Percentage change" value={adjustment.percentageChange} onChange={(event) => updateAdjustment(scenario.id, adjustment.id, (current) => current.kind === 'percentage' ? { ...current, percentageChange: Number(event.target.value) } : current)} helperText="Use a negative value for a reduction." />
                        </>}
                        <TextField select label="Start month" value={months.includes(adjustment.startMonth) ? adjustment.startMonth : ''} onChange={(event) => updateAdjustment(scenario.id, adjustment.id, (current) => ({ ...current, startMonth: event.target.value }))}>{months.map((month) => <MenuItem key={month} value={month}>{month}</MenuItem>)}</TextField>
                        {!(adjustment.kind === 'fixed' && adjustment.frequency === 'one_off') ? <TextField select label="End month (optional)" value={adjustment.endMonth ?? ''} onChange={(event) => updateAdjustment(scenario.id, adjustment.id, (current) => ({ ...current, endMonth: event.target.value || undefined }))}><MenuItem value="">Through horizon</MenuItem>{months.filter((month) => month >= adjustment.startMonth).map((month) => <MenuItem key={month} value={month}>{month}</MenuItem>)}</TextField> : null}
                      </Box>
                    </Stack>
                  </Box>
                ))}

                <Button startIcon={<AddRoundedIcon />} disabled={scenario.adjustments.length >= 10} onClick={() => updateScenario(scenario.id, (current) => ({ ...current, adjustments: [...current.adjustments, emptyAdjustment(months[0] ?? '')] }))}>Add adjustment</Button>
              </Stack>
            </Paper>
          ))}

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between">
            <Button startIcon={<AddRoundedIcon />} disabled={input.scenarios.length >= 3} onClick={() => updateInput((current) => ({ ...current, scenarios: [...current.scenarios, emptyScenario(months[0] ?? '', current.scenarios.length + 1)] }))}>Add scenario</Button>
            <Button variant="contained" disabled={running || !selectedBaseline} onClick={() => void runComparison()}>{running ? 'Calculating…' : 'Run comparison'}</Button>
          </Stack>

          <Paper variant="outlined" sx={{ p: 2.5, bgcolor: dashboardTokens.surface, borderColor: dashboardTokens.border }}>
            <Stack spacing={2}>
              <Box>
                <Typography variant="h6" fontWeight={700}>Save to library</Typography>
                <Typography variant="body2" sx={{ color: dashboardTokens.textMuted }}>
                  Saving a draft does not calculate it. Sharing is available only for a successfully calculated scenario.
                </Typography>
              </Box>
              {loadedScenario?.isStale ? (
                <Alert
                  severity="warning"
                  action={loadedScenario.isOwner ? (
                    <Button
                      color="inherit"
                      size="small"
                      disabled={saving}
                      onClick={() => {
                        if (window.confirm('Re-run this scenario using the latest observations? The stored result changes only if the new calculation succeeds.')) {
                          void saveScenario('calculated', savedVisibility, true)
                        }
                      }}
                    >
                      Re-run with latest data
                    </Button>
                  ) : undefined}
                >
                  The stored result is stale because its source observations changed or disappeared. The result shown remains the last saved calculation.
                </Alert>
              ) : null}
              {loadedScenario && !loadedScenario.isOwner ? (
                <Alert severity="info">This is a company-shared frozen result. Duplicate it, then choose one of your own sources before recalculating.</Alert>
              ) : null}
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr', gap: 2 }}>
                <TextField label="Library name" value={savedName} disabled={loadedScenario ? !loadedScenario.isOwner : false} onChange={(event) => setSavedName(event.target.value)} inputProps={{ maxLength: 80 }} />
                <TextField label="Description (optional)" value={savedDescription} disabled={loadedScenario ? !loadedScenario.isOwner : false} onChange={(event) => setSavedDescription(event.target.value)} inputProps={{ maxLength: 500 }} />
                <TextField select label="Visibility" value={savedVisibility} disabled={(loadedScenario ? !loadedScenario.isOwner : false) || !result || dirty} onChange={(event) => setSavedVisibility(event.target.value as ScenarioVisibility)}>
                  <MenuItem value="private">Private</MenuItem>
                  <MenuItem value="company">Company</MenuItem>
                </TextField>
              </Box>
              {(!loadedScenario || loadedScenario.isOwner) ? (
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="flex-end">
                  <Button disabled={saving} onClick={() => void saveScenario('draft', 'private', false)}>Save private draft</Button>
                  <Button
                    variant="contained"
                    disabled={saving || !result || dirty}
                    onClick={() => void saveScenario('calculated', savedVisibility, resultChanged || !editingScenarioId)}
                  >
                    Save calculated result
                  </Button>
                </Stack>
              ) : null}
            </Stack>
          </Paper>
        </Stack>
      ) : null}

        </Stack>

        <Box
          component="section"
          aria-label="Scenario comparison results"
          sx={{
            minWidth: 0,
            position: { xs: 'static', lg: 'sticky' },
            top: { lg: 88 },
            maxHeight: { lg: 'calc(100vh - 112px)' },
            overflowY: { lg: 'auto' },
            pr: { lg: 0.5 },
          }}
        >
          <Stack spacing={1.5}>
            <Box>
              <Typography variant="h5" fontWeight={700}>Comparison results</Typography>
              <Typography variant="body2" sx={{ color: dashboardTokens.textMuted, mt: 0.5 }}>
                Run the assumptions on the left to compare the baseline with up to three scenarios.
              </Typography>
            </Box>
          {dirty ? (
            <Alert severity="warning">
              {result
                ? 'These results are from the previous calculation. Your edited assumptions have not been applied yet—select Run comparison to update them.'
                : 'Changes not calculated. Select Run comparison to generate the comparison.'}
            </Alert>
          ) : null}
          {result ? (
            <GenUiWidgetRenderer
              widget={{ id: 'workspace-scenario-result', type: 'scenario_analysis', title: 'Scenario comparison results', reason: 'Calculated from the assumptions on the left using trusted deterministic code.', data: { result, editHref: '/dashboard/scenarios' } }}
              onAskChatbot={() => undefined}
            />
          ) : (
            <Paper
              variant="outlined"
              sx={{
                minHeight: 360,
                p: 4,
                bgcolor: dashboardTokens.surface,
                borderColor: dashboardTokens.border,
                display: 'grid',
                placeItems: 'center',
                textAlign: 'center',
              }}
            >
              <Box sx={{ maxWidth: 460 }}>
                <Typography variant="h6" fontWeight={700}>Your comparison will appear here</Typography>
                <Typography variant="body2" sx={{ color: dashboardTokens.textMuted, mt: 1 }}>
                  Choose a source, configure the scenarios on the left, then select Run comparison. Results remain visible here while you edit the controls.
                </Typography>
              </Box>
            </Paper>
          )}
          </Stack>
        </Box>
      </Box>
    </Stack>
  )
}
