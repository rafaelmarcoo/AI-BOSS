"use client";

import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { dashboardCanvasTokens as dashboardTokens } from "@/app/theme";
import { formatRunway } from "@/lib/calculations/runway-display";
import type {
  ScenarioComparisonWidget as ScenarioComparisonWidgetModel,
  ScenarioAnalysisWidget as ScenarioAnalysisWidgetModel,
} from "@/lib/gen-ui/types";
import { WidgetFrame } from "../../shared/WidgetFrame";
import {
  chartContextChipSx,
  formatAxisNumber,
  formatCurrency,
} from "../../shared/formatting";

export function ScenarioComparisonWidgetView({
  widget,
}: {
  widget: ScenarioComparisonWidgetModel;
}) {
  const rows = [widget.data.base, ...widget.data.scenarios];
  const maxRunway = Math.max(
    1,
    ...rows.map((row) => row.runwayMonths ?? 0)
  );

  return (
    <WidgetFrame title={widget.title} reason={widget.reason}>
      <Chip
        label={`Currency: ${widget.data.currency}`}
        size="small"
        sx={{ alignSelf: "flex-start", color: dashboardTokens.info, bgcolor: "rgba(43, 106, 155, 0.10)" }}
      />
      <Stack spacing={1.25}>
        {rows.map((row) => {
          const runwayPercent = ((row.runwayMonths ?? 0) / maxRunway) * 100;

          return (
            <Box key={row.label}>
              <Stack
                direction="row"
                justifyContent="space-between"
                spacing={1}
                sx={{ mb: 0.75 }}
              >
                <Typography variant="body2" fontWeight={700}>
                  {row.label}
                </Typography>
                <Typography variant="body2" sx={{ color: dashboardTokens.textMuted }}>
                  {formatCurrency(row.monthlyBurn, widget.data.currency)} burn
                </Typography>
              </Stack>
              <Stack direction="row" spacing={1.25} alignItems="center">
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box
                    sx={{
                      height: 8,
                      borderRadius: 999,
                      bgcolor: dashboardTokens.surfaceAlt,
                      overflow: "hidden",
                    }}
                  >
                    <Box
                      sx={{
                        width: `${Math.max(2, runwayPercent)}%`,
                        height: "100%",
                        bgcolor: row.label === "Current" ? dashboardTokens.info : "#6745A0",
                        borderRadius: 999,
                      }}
                    />
                  </Box>
                </Box>
                <Typography
                  variant="body2"
                  sx={{ width: 74, textAlign: "right", color: dashboardTokens.text }}
                >
                  {row.runwayMonths === null ? "Unavailable" : formatRunway(row.runwayMonths)}
                </Typography>
              </Stack>
            </Box>
          );
        })}
      </Stack>
      <Typography variant="caption" sx={{ color: dashboardTokens.textMuted }}>
        {widget.data.note}
      </Typography>
    </WidgetFrame>
  );
}

// Darker series colours keep chart lines and keys legible on the light canvas.
const SCENARIO_COLORS = ["#2563EB", "#7C3AED", "#C2410C", "#15803D"];

export function ScenarioAnalysisWidgetView({
  widget,
}: {
  widget: ScenarioAnalysisWidgetModel;
}) {
  const { result } = widget.data;
  const projectedMonths = result.panels.find((panel) => panel.available)?.series[0]?.points ?? [];
  const projectedPeriod = projectedMonths.length > 0
    ? `${projectedMonths[0].month}–${projectedMonths.at(-1)?.month}`
    : `${result.projectionStartMonth} onward`;
  const openEditor = () => {
    window.sessionStorage.setItem(
      "ai-boss-scenario-draft",
      JSON.stringify({ input: result.input, result }),
    );
    window.location.assign(widget.data.editHref);
  };

  return (
    <WidgetFrame title={widget.title} reason={widget.reason}>
      <Stack spacing={2}>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Chip label={`Currency: ${result.currency}`} size="small" sx={chartContextChipSx} />
          <Chip label={`Source: ${result.sourceLabel}`} size="small" sx={chartContextChipSx} />
          <Chip label={`Projected period: ${projectedPeriod}`} size="small" sx={chartContextChipSx} />
          <Chip label={`Horizon: ${result.input.horizon} months`} size="small" sx={chartContextChipSx} />
          <Chip label={`Historical range: ${result.input.trendRange.toUpperCase()}`} size="small" sx={chartContextChipSx} />
        </Stack>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "repeat(4, minmax(0, 1fr))" },
            gap: 1,
          }}
        >
          {[
            ["Cash", result.openingBridge.cash],
            ["Accounts receivable", result.openingBridge.accountsReceivable],
            ["Accounts payable", -result.openingBridge.accountsPayable],
            ["Opening liquidity", result.openingLiquidity],
          ].map(([label, value]) => (
            <Box key={String(label)} sx={{ p: 1.25, borderRadius: 1.5, bgcolor: dashboardTokens.surfaceAlt, border: "1px solid", borderColor: dashboardTokens.border }}>
              <Typography variant="caption" sx={{ color: dashboardTokens.textMuted }}>{label}</Typography>
              <Typography variant="body2" fontWeight={700}>{formatCurrency(Number(value), result.currency)}</Typography>
            </Box>
          ))}
        </Box>
        <Typography variant="caption" sx={{ color: dashboardTokens.textMuted }}>
          Opening available liquidity: {formatCurrency(result.openingBridge.cash, result.currency)} cash + {formatCurrency(result.openingBridge.accountsReceivable, result.currency)} receivables − {formatCurrency(result.openingBridge.accountsPayable, result.currency)} payables = {formatCurrency(result.openingLiquidity, result.currency)}. AI-BOSS assumes current receivables are collected and current payables are paid before Month 1.
        </Typography>

        <Box>
          <Typography variant="subtitle2" fontWeight={700}>Baseline inputs and evidence</Typography>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" }, gap: 1, mt: 1 }}>
            {([
              ["Cash", result.metricInputs.cash],
              ["Accounts receivable", result.metricInputs.accountsReceivable],
              ["Accounts payable", result.metricInputs.accountsPayable],
              ["Monthly burn", result.metricInputs.burnRate],
              ["Monthly revenue", result.metricInputs.monthlyRevenue],
              ["Monthly expenses", result.metricInputs.monthlyExpenses],
            ] as const).map(([label, metric]) => (
              <Box key={label} sx={{ p: 1.25, border: "1px solid", borderColor: dashboardTokens.border, borderRadius: 1 }}>
                <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="center">
                  <Typography variant="body2" fontWeight={700}>{label}</Typography>
                  <Chip
                    size="small"
                    color={metric?.origin === "manual" ? "warning" : metric ? "success" : "default"}
                    label={metric?.origin === "manual" ? "Manual — unreviewed" : metric ? "Stored observation" : "Missing"}
                  />
                </Stack>
                {metric ? (
                  <Typography variant="caption" display="block" sx={{ color: dashboardTokens.textMuted, mt: 0.5 }}>
                    {formatCurrency(metric.value, result.currency)} · {metric.sourceLabel} · reporting date {metric.reportingDate} · {metric.confidence === null ? "no verification confidence" : `${Math.round(metric.confidence * 100)}% confidence`}
                  </Typography>
                ) : (
                  <Typography variant="caption" sx={{ color: dashboardTokens.textMuted }}>Not available for this source.</Typography>
                )}
              </Box>
            ))}
          </Box>
        </Box>

        {result.warnings.map((warning) => (
          <Alert key={warning} severity="warning" variant="outlined">{warning}</Alert>
        ))}

        <Alert severity="info" variant="outlined">
          Both charts start from the same opening liquidity. The dashed Baseline means no new decision. Each coloured line adds that scenario&apos;s cash effects, beginning in its stated month. Each plotted month is the projected month-end balance, after that month&apos;s movement.
        </Alert>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", xl: "repeat(2, minmax(0, 1fr))" },
            gap: 2,
          }}
        >
          {result.panels.map((panel) => {
            if (!panel.available) {
              return (
                <Paper key={panel.method} variant="outlined" sx={{ p: 2, bgcolor: dashboardTokens.surfaceAlt, borderColor: dashboardTokens.border }}>
                  <Typography fontWeight={700}>{panel.label}</Typography>
                  <Alert severity="info" sx={{ mt: 1 }}>{panel.unavailableReason}</Alert>
                </Paper>
              );
            }

            const chartData = panel.series[0]?.points.map((point, index) => ({
              month: point.month,
              ...Object.fromEntries(panel.series.map((series) => [series.id, series.points[index]?.value])),
            })) ?? [];

            return (
              <Paper key={panel.method} variant="outlined" sx={{ p: { xs: 1.5, sm: 2 }, bgcolor: dashboardTokens.surface, borderColor: dashboardTokens.border, boxShadow: "0 6px 18px rgba(32,58,80,0.05)" }}>
                <Typography fontWeight={700}>
                  {panel.method === "current_run_rate"
                    ? "Current run rate (latest monthly burn)"
                    : "Historical trend (past cash movement continued)"}
                </Typography>
                <Typography variant="caption" sx={{ color: dashboardTokens.textMuted }}>
                  Baseline monthly movement: {formatCurrency(panel.baselineMonthlyMovement, result.currency)}
                </Typography>
                <Typography variant="body2" sx={{ color: dashboardTokens.textMuted, mt: 0.75 }}>
                  {panel.method === "current_run_rate"
                    ? `Shows what happens if the latest monthly burn of ${formatCurrency(Math.abs(panel.baselineMonthlyMovement ?? 0), result.currency)} continues every month.`
                    : `Shows what happens if the observed cash trend of ${formatCurrency(panel.baselineMonthlyMovement ?? 0, result.currency)} per month continues.`}
                </Typography>
                <Typography variant="caption" display="block" sx={{ color: dashboardTokens.textMuted, mt: 0.5 }}>
                  Value axis: Projected available liquidity ({result.currency}) · Time axis: Projection month
                </Typography>
                <Box sx={{ height: 290, mt: 1 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 12, right: 14, left: 8, bottom: 26 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={dashboardTokens.border} />
                      <XAxis dataKey="month" stroke={dashboardTokens.textSoft} tick={{ fill: dashboardTokens.textSoft, fontSize: 12 }} />
                      <YAxis width={72} stroke={dashboardTokens.textSoft} tick={{ fill: dashboardTokens.textSoft, fontSize: 12 }} tickFormatter={(value) => formatAxisNumber(Number(value), false)} />
                      <Legend wrapperStyle={{ color: dashboardTokens.text, fontSize: 12, paddingTop: 8 }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: dashboardTokens.surface, color: dashboardTokens.text, border: `1px solid ${dashboardTokens.border}`, borderRadius: 8, boxShadow: "0 8px 24px rgba(32,58,80,0.12)" }}
                        labelStyle={{ color: dashboardTokens.text, fontWeight: 700 }}
                        itemStyle={{ color: dashboardTokens.textSoft }}
                        formatter={(value, name) => [formatCurrency(Number(value), result.currency), panel.series.find((series) => series.id === name)?.label ?? name]}
                      />
                      {panel.series.map((series, index) => (
                        <Line
                          key={series.id}
                          type="monotone"
                          dataKey={series.id}
                          name={series.label}
                          stroke={SCENARIO_COLORS[index]}
                          strokeWidth={series.kind === "baseline" ? 2 : 2.5}
                          strokeDasharray={series.kind === "baseline" ? "6 4" : undefined}
                          dot={false}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </Box>
                <Stack spacing={0.75}>
                  {panel.series.map((series, index) => (
                    <Box key={series.id}>
                      <Stack direction="row" justifyContent="space-between" spacing={1}>
                        <Stack direction="row" spacing={0.75} alignItems="center">
                          <Box sx={{ width: 9, height: 9, borderRadius: "50%", bgcolor: SCENARIO_COLORS[index], flexShrink: 0 }} />
                          <Typography variant="caption" sx={{ color: dashboardTokens.text, fontWeight: 700 }}>{series.label}</Typography>
                        </Stack>
                        <Typography variant="caption" sx={{ color: dashboardTokens.textMuted, textAlign: "right" }}>
                          End {formatCurrency(series.summary.endingLiquidity, result.currency)} · {series.summary.cashOutMonth ? `cash-out ${series.summary.cashOutMonth}` : "no cash-out in horizon"}
                        </Typography>
                      </Stack>
                      <Typography variant="caption" display="block" sx={{ color: dashboardTokens.textMuted }}>
                        Change vs baseline {formatCurrency(series.summary.changeFromBaseline, result.currency)} · lowest {formatCurrency(series.summary.lowestLiquidity, result.currency)} · average monthly net movement {formatCurrency(series.summary.averageMonthlyNetMovement, result.currency)}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              </Paper>
            );
          })}
        </Box>

        <Box>
          <Typography variant="subtitle2" fontWeight={700}>Scenario assumptions</Typography>
          {result.input.scenarios.map((scenario) => (
            <Box key={scenario.id} sx={{ mt: 1, p: 1.25, border: "1px solid", borderColor: dashboardTokens.border, borderRadius: 1 }}>
              <Typography variant="body2" fontWeight={700}>{scenario.label}</Typography>
              {scenario.adjustments.map((adjustment) => {
                const resolved = result.panels.find((panel) => panel.available)?.series
                  .find((series) => series.id === scenario.id)?.resolvedAdjustments
                  .find((item) => item.id === adjustment.id);
                return <Typography key={adjustment.id} variant="caption" display="block" sx={{ color: dashboardTokens.textMuted }}>{resolved?.description ?? adjustment.label}</Typography>;
              })}
            </Box>
          ))}
        </Box>

        <Accordion disableGutters sx={{ bgcolor: "transparent", border: "1px solid", borderColor: dashboardTokens.border, "&:before": { display: "none" } }}>
          <AccordionSummary expandIcon={<ExpandMoreRoundedIcon />}>
            <Typography fontWeight={700}>View month-by-month values</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <TableContainer sx={{ border: "1px solid", borderColor: dashboardTokens.border, borderRadius: 1.5 }}>
              <Table size="small" aria-label="Monthly scenario comparison" sx={{ minWidth: 720 }}>
                <TableHead sx={{ bgcolor: dashboardTokens.surfaceAlt }}><TableRow><TableCell sx={{ fontWeight: 700 }}>Method</TableCell><TableCell sx={{ fontWeight: 700 }}>Series</TableCell><TableCell sx={{ fontWeight: 700 }}>Month</TableCell><TableCell align="right" sx={{ fontWeight: 700 }}>Liquidity</TableCell><TableCell align="right" sx={{ fontWeight: 700 }}>Net movement</TableCell></TableRow></TableHead>
                <TableBody>
                  {result.panels.flatMap((panel) => panel.series.flatMap((series) => series.points.map((point) => (
                    <TableRow key={`${panel.method}-${series.id}-${point.month}`}>
                      <TableCell>{panel.label}</TableCell><TableCell>{series.label}</TableCell><TableCell>{point.month}</TableCell>
                      <TableCell align="right">{formatCurrency(point.value, result.currency)}</TableCell>
                      <TableCell align="right">{formatCurrency(point.netMovement, result.currency)}</TableCell>
                    </TableRow>
                  ))))}
                </TableBody>
              </Table>
            </TableContainer>
          </AccordionDetails>
        </Accordion>

        <Divider />
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} justifyContent="space-between" alignItems={{ sm: "center" }}>
          <Typography variant="caption" sx={{ color: dashboardTokens.textMuted }}>
            Deterministic model only. Review major decisions with a qualified professional.
          </Typography>
          <Button variant="outlined" onClick={openEditor}>Edit in Scenarios workspace</Button>
        </Stack>
      </Stack>
    </WidgetFrame>
  );
}
