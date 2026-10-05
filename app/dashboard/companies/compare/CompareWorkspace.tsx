"use client";

import { Fragment, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import CompareArrowsRoundedIcon from "@mui/icons-material/CompareArrowsRounded";
import ExpandLessRoundedIcon from "@mui/icons-material/ExpandLessRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import ForumRoundedIcon from "@mui/icons-material/ForumRounded";
import type { CompanySummary } from "@/lib/company-analysis/persistence";
import {
  formatAmount,
  formatRatioValue,
  type CompanyComparison,
  type RatioKey,
} from "@/lib/company-analysis/statement-analysis";
import {
  groupRatios,
  RATIO_MEANINGS,
  ratiosOnlyOneHas,
  verdict,
  workingFor,
} from "@/lib/company-analysis/compare-view";
import { dashboardTokens } from "@/app/theme";
import { useCompanyChat } from "../CompanyChatShell";

interface ComparedCompany {
  id: string;
  name: string;
  source: string;
  isOwn: boolean;
  fiscalYearEnd: string | null;
}

interface CompareResult {
  comparison: CompanyComparison;
  companies: { first: ComparedCompany; second: ComparedCompany };
}

interface ApiPayload<T> {
  success: boolean;
  data?: T;
  error?: { message?: string };
}

const STRONGER_STYLE = { color: "#86efac", bgcolor: "rgba(34,197,94,0.14)" };
const NEUTRAL_STYLE = { color: dashboardTokens.textMuted, bgcolor: "rgba(255,255,255,0.06)" };

export function CompareWorkspace({ initialFirst, initialSecond }: { initialFirst: string | null; initialSecond: string | null }) {
  const router = useRouter();
  const [companies, setCompanies] = useState<CompanySummary[]>([]);
  const [first, setFirst] = useState(initialFirst ?? "");
  const [second, setSecond] = useState(initialSecond ?? "");
  const [result, setResult] = useState<CompareResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openWorking, setOpenWorking] = useState<RatioKey | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/companies")
      .then((response) => response.json() as Promise<ApiPayload<{ companies: CompanySummary[] }>>)
      .then((payload) => {
        if (cancelled) return;
        if (!payload.success || !payload.data) throw new Error(payload.error?.message ?? "Could not load companies.");
        const list = payload.data.companies;
        setCompanies(list);
        if (initialFirst && !initialSecond) {
          const chosen = list.find((company) => company.id === initialFirst);
          const competitor = list.find(
            (company) => company.id !== initialFirst && chosen?.competitors.includes(company.name),
          );
          if (competitor) setSecond(competitor.id);
        }
      })
      .catch((requestError) => !cancelled && setError(requestError instanceof Error ? requestError.message : "Could not load companies."));
    return () => {
      cancelled = true;
    };
  }, [initialFirst, initialSecond]);

  useEffect(() => {
    if (!first || !second || first === second) return;
    router.replace(`/dashboard/companies/compare?first=${encodeURIComponent(first)}&second=${encodeURIComponent(second)}`, { scroll: false });

    let cancelled = false;
    Promise.resolve()
      .then(() => {
        if (cancelled) return null;
        setLoading(true);
        setError(null);
        return fetch(`/api/companies/compare?first=${encodeURIComponent(first)}&second=${encodeURIComponent(second)}`);
      })
      .then((response) => (response ? (response.json() as Promise<ApiPayload<CompareResult>>) : null))
      .then((payload) => {
        if (cancelled || !payload) return;
        if (!payload.success || !payload.data) throw new Error(payload.error?.message ?? "Could not compare these companies.");
        setResult(payload.data);
      })
      .catch((requestError) => !cancelled && setError(requestError instanceof Error ? requestError.message : "Could not compare these companies."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [first, second, router]);

  const swap = () => {
    setFirst(second);
    setSecond(first);
  };

  const comparison = result?.comparison ?? null;
  const names = result ? { first: result.companies.first.name, second: result.companies.second.name } : null;

  const { setCompanies: setChatCompanies, ask: askChat } = useCompanyChat();
  const firstName = names?.first ?? null;
  const secondName = names?.second ?? null;
  useEffect(() => {
    setChatCompanies([firstName, secondName].filter((name): name is string => name !== null));
  }, [firstName, secondName, setChatCompanies]);


  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} justifyContent="space-between" alignItems={{ xs: "stretch", sm: "flex-start" }}>
        <Stack direction="row" spacing={1.5} alignItems="flex-start">
          <Box sx={{ display: "grid", placeItems: "center", width: 44, height: 44, borderRadius: 2.5, bgcolor: "rgba(59,130,246,0.16)", color: "#93c5fd", flex: "0 0 auto" }}>
            <CompareArrowsRoundedIcon />
          </Box>
          <Stack spacing={0.5}>
            <Typography variant="h5" fontWeight={700} color="common.white">Compare companies</Typography>
            <Typography variant="body2" sx={{ color: dashboardTokens.textMuted }}>
              Two companies side by side, from their latest statements. Calculated by AI-BOSS, with no AI involved.
            </Typography>
          </Stack>
        </Stack>
        <Button href="/dashboard/companies" startIcon={<ArrowBackRoundedIcon />} sx={{ borderRadius: 2, whiteSpace: "nowrap" }}>
          Back to companies
        </Button>
      </Stack>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ sm: "center" }}>
        <CompanyPicker label="First company" value={first} onChange={setFirst} companies={companies} exclude={second} />
        <Button onClick={swap} disabled={!first || !second} sx={{ borderRadius: 2, minWidth: 0 }} aria-label="Swap companies">
          <CompareArrowsRoundedIcon />
        </Button>
        <CompanyPicker label="Second company" value={second} onChange={setSecond} companies={companies} exclude={first} />
      </Stack>

      {error ? <Alert severity="error">{error}</Alert> : null}

      {!first || !second ? (
        <Typography variant="body2" sx={{ color: dashboardTokens.textMuted }}>Pick two companies to compare.</Typography>
      ) : loading && !comparison ? (
        <Stack alignItems="center" sx={{ py: 8 }}><CircularProgress /></Stack>
      ) : comparison && names && result ? (
        <Stack spacing={3} sx={{ opacity: loading ? 0.6 : 1 }}>
          <Header result={result} />

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
            <Button
              variant="outlined"
              onClick={() => askChat(`Compare ${names.first} with ${names.second}`)}
              startIcon={<ForumRoundedIcon />}
              sx={{ borderRadius: 2, whiteSpace: "nowrap", alignSelf: "flex-start" }}
            >
              Explain this in chat
            </Button>
            <Typography variant="caption" sx={{ color: dashboardTokens.textMuted }}>
              Opens the chat on this page and asks the AI to explain this comparison (this uses AI). You can
              also highlight any figure and click &quot;Ask chatbot&quot;.
            </Typography>
          </Stack>

          <Section title="Ratios" caption="Click a ratio to see how it was worked out for each company. Green marks the stronger company on that ratio; there is no overall score, because ratios don't all matter equally.">
            <TableContainer sx={tableStyles}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Ratio</TableCell>
                    <TableCell align="right">{names.first}</TableCell>
                    <TableCell align="right">{names.second}</TableCell>
                    <TableCell align="right">Stronger</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {groupRatios(comparison.ratios).map((group) => (
                    <Fragment key={group.category}>
                      <TableRow>
                        <TableCell colSpan={4} sx={{ fontWeight: 700, color: "#93c5fd", bgcolor: "rgba(59,130,246,0.08)" }}>
                          {group.heading}
                        </TableCell>
                      </TableRow>
                      {group.ratios.map((ratio) => {
                        const outcome = verdict(ratio);
                        const isOpen = openWorking === ratio.key;
                        const firstStronger = outcome.kind === "stronger" && outcome.text === names.first;
                        const secondStronger = outcome.kind === "stronger" && outcome.text === names.second;
                        return (
                          <Fragment key={ratio.key}>
                            <TableRow hover onClick={() => setOpenWorking(isOpen ? null : ratio.key)} sx={{ cursor: "pointer" }}>
                              <TableCell>
                                <Stack direction="row" spacing={0.5} alignItems="center">
                                  {isOpen ? <ExpandLessRoundedIcon fontSize="small" /> : <ExpandMoreRoundedIcon fontSize="small" />}
                                  <Box>
                                    <Typography variant="body2" fontWeight={600}>{ratio.label}</Typography>
                                    <Typography variant="caption" sx={{ color: dashboardTokens.textMuted }}>{RATIO_MEANINGS[ratio.key]}</Typography>
                                  </Box>
                                </Stack>
                              </TableCell>
                              <TableCell align="right" sx={{ fontVariantNumeric: "tabular-nums", ...(firstStronger ? { color: STRONGER_STYLE.color, fontWeight: 700 } : {}) }}>
                                {formatRatioValue(ratio.first, ratio.unit)}
                              </TableCell>
                              <TableCell align="right" sx={{ fontVariantNumeric: "tabular-nums", ...(secondStronger ? { color: STRONGER_STYLE.color, fontWeight: 700 } : {}) }}>
                                {formatRatioValue(ratio.second, ratio.unit)}
                              </TableCell>
                              <TableCell align="right">
                                <Chip
                                  label={outcome.text}
                                  size="small"
                                  sx={outcome.kind === "stronger" ? STRONGER_STYLE : NEUTRAL_STYLE}
                                />
                              </TableCell>
                            </TableRow>
                            {isOpen ? (
                              <TableRow>
                                <TableCell colSpan={4} sx={{ bgcolor: "rgba(255,255,255,0.03)" }}>
                                  <Stack spacing={0.5}>
                                    <Typography variant="body2"><strong>{names.first}:</strong> {workingFor(comparison, "first", ratio.key) ?? "–"}</Typography>
                                    <Typography variant="body2"><strong>{names.second}:</strong> {workingFor(comparison, "second", ratio.key) ?? "–"}</Typography>
                                    {outcome.kind === "trade-off" ? (
                                      <Typography variant="caption" sx={{ color: dashboardTokens.textMuted }}>
                                        No winner here: higher or lower can each be right, depending on the business.
                                      </Typography>
                                    ) : null}
                                  </Stack>
                                </TableCell>
                              </TableRow>
                            ) : null}
                          </Fragment>
                        );
                      })}
                    </Fragment>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Section>

          <OneSided comparison={comparison} />

          <Section title="Growth" caption="Change from each company's previous year to its latest.">
            <TableContainer sx={tableStyles}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Measure</TableCell>
                    <TableCell align="right">{names.first}</TableCell>
                    <TableCell align="right">{names.second}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {comparison.growth.map((row) => (
                    <TableRow key={row.label}>
                      <TableCell>{row.label}</TableCell>
                      <TableCell align="right">{growthText(row.first)}</TableCell>
                      <TableCell align="right">{growthText(row.second)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Section>

          <Section title="Size" caption="Size is context, not performance: a bigger company isn't automatically a stronger one.">
            {comparison.size.comparable ? (
              <TableContainer sx={tableStyles}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Line</TableCell>
                      <TableCell align="right">{names.first}</TableCell>
                      <TableCell align="right">{names.second}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {comparison.size.lines.map((line) => (
                      <TableRow key={line.label}>
                        <TableCell>{line.label}</TableCell>
                        <TableCell align="right">{formatAmount(line.first, comparison.first.currency, comparison.first.amountsIn)}</TableCell>
                        <TableCell align="right">{formatAmount(line.second, comparison.second.currency, comparison.second.amountsIn)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Alert severity="info">{comparison.size.reason}</Alert>
            )}
          </Section>

          <Streams comparison={comparison} />
        </Stack>
      ) : null}
    </Stack>
  );
}

function CompanyPicker({ label, value, onChange, companies, exclude }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  companies: CompanySummary[];
  exclude: string;
}) {
  return (
    <FormControl sx={{ flex: 1, minWidth: 200 }}>
      <InputLabel>{label}</InputLabel>
      <Select label={label} value={companies.some((company) => company.id === value) ? value : ""} onChange={(event) => onChange(event.target.value)}>
        {companies.filter((company) => company.id !== exclude).map((company) => (
          <MenuItem key={company.id} value={company.id}>
            {company.name} {company.isOwn ? "(yours)" : "(case study)"}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

function Header({ result }: { result: CompareResult }) {
  const { comparison, companies } = result;
  const sides = [
    [companies.first, comparison.first],
    [companies.second, comparison.second],
  ] as const;

  return (
    <Stack spacing={1}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
        {sides.map(([company, analysis]) => (
          <Box key={company.id} sx={{ ...cardStyles, flex: 1 }}>
            <Typography color="common.white" fontWeight={700}>{company.name}</Typography>
            <Typography variant="caption" sx={{ color: dashboardTokens.textMuted, display: "block" }}>
              {analysis.currency} {analysis.amountsIn}
              {company.fiscalYearEnd ? `, latest year ended ${formatYear(company.fiscalYearEnd)}` : ""}
            </Typography>
            <Typography variant="caption" sx={{ color: dashboardTokens.textMuted, display: "block", overflowWrap: "anywhere" }}>
              Source: {company.source}
            </Typography>
          </Box>
        ))}
      </Stack>
      {comparison.periodNote ? <Alert severity="info">{comparison.periodNote}</Alert> : null}
    </Stack>
  );
}

function OneSided({ comparison }: { comparison: CompanyComparison }) {
  const oneSided = ratiosOnlyOneHas(comparison);
  if (oneSided.length === 0) return null;

  return (
    <Section title="Not comparable" caption="Ratios only one company has, so they can't be compared side by side.">
      <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
        {oneSided.map((ratio) => (
          <li key={`${ratio.has}-${ratio.key}`}>
            <Typography variant="body2">
              <strong>{ratio.label}</strong> ({ratio.has} only): {ratio.reason}
            </Typography>
          </li>
        ))}
      </Box>
    </Section>
  );
}

function Streams({ comparison }: { comparison: CompanyComparison }) {
  const sides = [comparison.first, comparison.second].filter((side) => side.latest.streams.length > 0);
  if (sides.length === 0) return null;

  return (
    <Section title="Revenue streams" caption="Where each company's revenue comes from, and how much is left after each stream's direct costs.">
      <Stack spacing={1.5}>
        {sides.map((side) => (
          <TableContainer key={side.name} sx={tableStyles}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{side.name}</TableCell>
                  <TableCell align="right">Revenue</TableCell>
                  <TableCell align="right">Share</TableCell>
                  <TableCell align="right">Margin after direct costs</TableCell>
                  <TableCell align="right">Growth</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {side.latest.streams.map((stream) => (
                  <TableRow key={stream.name}>
                    <TableCell>{stream.name}</TableCell>
                    <TableCell align="right">{formatAmount(stream.revenue, side.currency, side.amountsIn)}</TableCell>
                    <TableCell align="right">{stream.shareOfRevenuePercent.toFixed(1)}%</TableCell>
                    <TableCell align="right">
                      {stream.marginAfterDirectCostsPercent === null ? "No direct costs reported" : `${stream.marginAfterDirectCostsPercent.toFixed(1)}%`}
                    </TableCell>
                    <TableCell align="right">{growthText(stream.growthPercent)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        ))}
      </Stack>
    </Section>
  );
}

function Section({ title, caption, children }: { title: string; caption: string; children: React.ReactNode }) {
  return (
    <Stack spacing={1}>
      <Typography variant="subtitle1" fontWeight={700} color="common.white">{title}</Typography>
      <Typography variant="caption" sx={{ color: dashboardTokens.textMuted }}>{caption}</Typography>
      {children}
    </Stack>
  );
}

function growthText(value: number | null) {
  if (value === null) return "–";
  const arrow = value > 0 ? "▲" : value < 0 ? "▼" : "–";
  return `${arrow} ${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function formatYear(fiscalYearEnd: string) {
  return new Date(`${fiscalYearEnd}T00:00:00Z`).toLocaleDateString("en-NZ", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

const tableStyles = { border: "1px solid", borderColor: dashboardTokens.border, borderRadius: 2 };

const cardStyles = {
  p: 1.5,
  borderRadius: 2,
  border: "1px solid",
  borderColor: dashboardTokens.border,
  bgcolor: "rgba(255,255,255,0.035)",
};
