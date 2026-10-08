"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  FormHelperText,
  InputLabel,
  Link,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import UploadFileRoundedIcon from "@mui/icons-material/UploadFileRounded";
import type { CompanySummary } from "@/lib/company-analysis/persistence";
import type { StatementUploadReview } from "@/lib/company-analysis/statement-upload";
import { statementTableRows } from "@/lib/company-analysis/statement-template";
import { cellKey, compareWithSaved, describeComparison, type SavedComparison } from "@/lib/company-analysis/compare-with-saved";
import type { StatementYear } from "@/lib/company-analysis/statement-analysis";
import { yearOnYearChange, type YearChange } from "@/lib/company-analysis/year-change";
import { dashboardCanvasTokens as dashboardTokens } from "@/app/theme";
import { downloadStatementTemplate, type TemplateKind } from "@/lib/company-analysis/download-template";

interface ApiPayload<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: { message?: string; details?: Record<string, unknown> };
}

interface AddCompanyDialogProps {
  open: boolean;
  companies: CompanySummary[];
  editing?: CompanySummary | null;
  initialFile?: File | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}

interface DetailsForm {
  name: string;
  industry: string;
  currency: string;
  amountsIn: "" | "units" | "thousands" | "millions";
  competitorOf: string;
}
const EMPTY_DETAILS: DetailsForm = { name: "", industry: "", currency: "NZD", amountsIn: "", competitorOf: "" };

function startingDetails(editing: CompanySummary | null, companies: CompanySummary[]): DetailsForm {
  if (!editing) return EMPTY_DETAILS;
  const competitor = companies.find(
    (company) => company.id !== editing.id && editing.competitors.includes(company.name),
  );
  return {
    name: editing.name,
    industry: editing.industry ?? "",
    currency: editing.currency,
    amountsIn: editing.amountsIn,
    competitorOf: competitor?.id ?? "",
  };
}

interface PreviewResult {
  review: StatementUploadReview;
  saved: StatementYear[] | null;
}

async function fetchReview(file: File, companyId?: string): Promise<PreviewResult> {
  const body = new FormData();
  body.set("file", file);
  if (companyId) body.set("companyId", companyId);
  const response = await fetch("/api/companies/preview", { method: "POST", body });
  const payload = (await response.json()) as ApiPayload<PreviewResult>;

  if (!response.ok || !payload.success || !payload.data) {
    throw new Error(payload.error?.message ?? "Could not read the file.");
  }
  return payload.data;
}

export function AddCompanyDialog({
  open,
  companies,
  editing = null,
  initialFile = null,
  onClose,
  onSaved,
}: AddCompanyDialogProps) {
  const [file, setFile] = useState<File | null>(initialFile);
  const [review, setReview] = useState<StatementUploadReview | null>(null);
  const [saved, setSaved] = useState<StatementYear[] | null>(null);
  const [details, setDetails] = useState<DetailsForm>(() => startingDetails(editing, companies));
  const [confirmedChecks, setConfirmedChecks] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [checking, setChecking] = useState(Boolean(initialFile));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (error) errorRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [error]);

  useEffect(() => {
    if (!initialFile) return;
    let cancelled = false;
    fetchReview(initialFile, editing?.id)
      .then((result) => {
        if (cancelled) return;
        setReview(result.review);
        setSaved(result.saved);
      })
      .catch((requestError) => !cancelled && setError(requestError instanceof Error ? requestError.message : "Could not read the file."))
      .finally(() => !cancelled && setChecking(false));
    return () => {
      cancelled = true;
    };
  }, [initialFile, editing?.id]);

  const busy = checking || saving;

  const downloadTemplate = (kind: TemplateKind) => {
    downloadStatementTemplate(kind).catch(() => setError("Could not create the template. Please try again."));
  };

  const reset = () => {
    setFile(null);
    setReview(null);
    setSaved(null);
    setDetails(startingDetails(editing, companies));
    setConfirmedChecks(false);
    setFieldErrors({});
    setError(null);
  };

  const close = () => {
    if (busy) return;
    reset();
    onClose();
  };

  const chooseFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const chosen = event.target.files?.[0];
    event.target.value = "";
    if (!chosen) return;
    setFile(chosen);
    setReview(null);
    setSaved(null);
    setConfirmedChecks(false);
    setError(null);
    setChecking(true);

    try {
      const result = await fetchReview(chosen, editing?.id);
      setReview(result.review);
      setSaved(result.saved);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not read the file.");
    } finally {
      setChecking(false);
    }
  };

  const keepCurrentFigures = () => {
    setFile(null);
    setReview(null);
    setSaved(null);
    setConfirmedChecks(false);
    setError(null);
  };

  const updateDetail = <K extends keyof DetailsForm>(key: K, value: DetailsForm[K]) => {
    setDetails((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => {
      const rest = { ...current };
      delete rest[key];
      return rest;
    });
  };

  const save = async () => {
    if (!file && !editing) return;

    setSaving(true);
    setError(null);
    setFieldErrors({});

    try {
      const body = new FormData();
      if (file) body.set("file", file);
      body.set("name", details.name);
      body.set("industry", details.industry);
      body.set("currency", details.currency);
      body.set("amountsIn", details.amountsIn);
      if (details.competitorOf) body.set("competitorOf", details.competitorOf);
      body.set("confirmedChecks", String(confirmedChecks));

      const response = editing
        ? await fetch(`/api/companies/${encodeURIComponent(editing.id)}`, { method: "PUT", body })
        : await fetch("/api/companies", { method: "POST", body });
      const payload = (await response.json()) as ApiPayload<unknown>;

      if (!response.ok || !payload.success) {
        const problems = payload.error?.details ?? {};
        setFieldErrors(
          Object.fromEntries(
            Object.entries(problems).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
          ),
        );
        throw new Error(payload.error?.message ?? "Could not save the company.");
      }

      reset();
      onSaved(payload.message ?? (editing ? "Changes saved." : "Company added."));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not save the company.");
    } finally {
      setSaving(false);
    }
  };

  const fileReady =
    file === null
      ? Boolean(editing)
      : Boolean(review) && review!.errors.length === 0 && (review!.failedChecks.length === 0 || confirmedChecks);

  const canSave =
    fileReady &&
    details.name.trim() !== "" &&
    details.currency.trim() !== "" &&
    details.amountsIn !== "" &&
    !busy;

  return (
    <Dialog open={open} onClose={close} fullWidth maxWidth="md" scroll="paper">
      <DialogTitle>{editing ? `Edit ${editing.name}` : "Add a company"}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          {editing ? (
            <Typography variant="body2" sx={{ color: dashboardTokens.textMuted }}>
              Change any details below. To replace the figures, choose a new file: it gets the same checks
              as a new company. Anything you don&apos;t change stays as it is.
            </Typography>
          ) : (
            <>
              <Typography variant="body2" sx={{ color: dashboardTokens.textMuted }}>
                Upload the company&apos;s financial statements as a CSV file, using the template. Nothing is
                saved until you press Save.
              </Typography>

              <Typography variant="body2" sx={{ color: dashboardTokens.textMuted }}>
                Don&apos;t have the template? Download the{" "}
                <Link component="button" type="button" onClick={() => downloadTemplate("blank")}>blank template</Link>
                {" "}or see{" "}
                <Link component="button" type="button" onClick={() => downloadTemplate("example")}>an example</Link>.
              </Typography>
            </>
          )}

          <Stack direction="row" spacing={1.5} alignItems="center">
            <Button
              component="label"
              variant={review || editing ? "outlined" : "contained"}
              startIcon={<UploadFileRoundedIcon />}
              disabled={busy}
              sx={{ borderRadius: 2, whiteSpace: "nowrap" }}
            >
              {file ? "Choose a different file" : editing ? "Choose a new file (optional)" : "Choose CSV file"}
              <input hidden type="file" accept=".csv,text/csv" onChange={(event) => void chooseFile(event)} />
            </Button>
            {file ? (
              <Typography variant="body2" sx={{ color: dashboardTokens.textMuted, overflowWrap: "anywhere" }}>
                {file.name}
              </Typography>
            ) : null}
            {editing && file && !busy ? (
              <Link component="button" type="button" onClick={keepCurrentFigures}>Keep current figures</Link>
            ) : null}
          </Stack>

          {checking ? (
            <Stack direction="row" spacing={1.5} alignItems="center">
              <CircularProgress size={20} />
              <Typography variant="body2">Reading and checking the file…</Typography>
            </Stack>
          ) : null}

          {review ? (
            <ReviewSummary review={review} saved={saved} currency={details.currency} amountsIn={details.amountsIn} />
          ) : null}

          {editing || (review && review.errors.length === 0) ? (
            <Stack spacing={2}>
              <Typography variant="subtitle1" fontWeight={700}>Company details</Typography>

              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                <TextField
                  label="Company name"
                  required
                  value={details.name}
                  onChange={(event) => updateDetail("name", event.target.value)}
                  error={Boolean(fieldErrors.name)}
                  helperText={fieldErrors.name}
                  slotProps={{ htmlInput: { maxLength: 120 } }}
                  sx={{ flex: 1 }}
                />
                <TextField
                  label="Industry (optional)"
                  value={details.industry}
                  onChange={(event) => updateDetail("industry", event.target.value)}
                  error={Boolean(fieldErrors.industry)}
                  helperText={fieldErrors.industry}
                  slotProps={{ htmlInput: { maxLength: 120 } }}
                  sx={{ flex: 1 }}
                />
              </Stack>

              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                <TextField
                  label="Currency"
                  required
                  value={details.currency}
                  onChange={(event) => updateDetail("currency", event.target.value.toUpperCase())}
                  error={Boolean(fieldErrors.currency)}
                  helperText={fieldErrors.currency ?? "For example NZD, AUD or USD."}
                  slotProps={{ htmlInput: { maxLength: 4 } }}
                  sx={{ flex: 1 }}
                />
                <FormControl required error={Boolean(fieldErrors.amountsIn)} sx={{ flex: 1 }}>
                  <InputLabel>Figures are in</InputLabel>
                  <Select
                    label="Figures are in"
                    value={details.amountsIn}
                    onChange={(event) => updateDetail("amountsIn", event.target.value as DetailsForm["amountsIn"])}
                  >
                    <MenuItem value="units">Units (full amounts)</MenuItem>
                    <MenuItem value="thousands">Thousands ($000)</MenuItem>
                    <MenuItem value="millions">Millions ($m)</MenuItem>
                  </Select>
                  <FormHelperText>
                    {fieldErrors.amountsIn ?? "Look for $000 or $m at the top of the statements."}
                  </FormHelperText>
                </FormControl>
              </Stack>

              <FormControl error={Boolean(fieldErrors.competitorOf)}>
                <InputLabel>Competes with (optional)</InputLabel>
                <Select
                  label="Competes with (optional)"
                  value={details.competitorOf}
                  onChange={(event) => updateDetail("competitorOf", event.target.value)}
                >
                  <MenuItem value="">No competitor yet</MenuItem>
                  {companies.filter((company) => company.id !== editing?.id).map((company) => (
                    <MenuItem key={company.id} value={company.id}>{company.name}</MenuItem>
                  ))}
                </Select>
                <FormHelperText>
                  {fieldErrors.competitorOf ?? "Pick a company it competes with, so you can compare them in chat."}
                </FormHelperText>
              </FormControl>

              {review && review.failedChecks.length > 0 ? (
                <FormControlLabel
                  control={
                    <Checkbox checked={confirmedChecks} onChange={(event) => setConfirmedChecks(event.target.checked)} />
                  }
                  label="I've checked these figures against the original statements and they're correct."
                />
              ) : null}

              {editing && review && review.errors.length === 0 ? (
                <Alert severity="info">
                  Saving replaces all of {editing.name}&apos;s saved figures with the figures in this file.
                </Alert>
              ) : null}
            </Stack>
          ) : null}

          {error ? <Alert ref={errorRef} severity="error">{error}</Alert> : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={close} disabled={busy}>Cancel</Button>
        {editing || (review && review.errors.length === 0) ? (
          <Button variant="contained" disabled={!canSave} onClick={() => void save()}>
            {saving ? "Saving…" : editing ? "Save changes" : "Save company"}
          </Button>
        ) : null}
      </DialogActions>
    </Dialog>
  );
}

interface ScaleProps {
  currency: string;
  amountsIn: DetailsForm["amountsIn"];
}

function ReviewSummary({
  review,
  saved,
  currency,
  amountsIn,
}: { review: StatementUploadReview; saved: StatementYear[] | null } & ScaleProps) {
  const comparison = saved && review.years.length > 0 ? compareWithSaved(review.years, saved) : null;

  return (
    <Stack spacing={2}>
      {review.errors.length > 0 ? (
        <Alert severity="error">
          <Typography variant="body2" fontWeight={600}>
            Fix these in the file, then choose it again:
          </Typography>
          <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
            {review.errors.map((message) => <li key={message}>{message}</li>)}
          </Box>
        </Alert>
      ) : review.failedChecks.length > 0 ? (
        <Alert severity="warning">
          <Typography variant="body2" fontWeight={600}>
            {`${review.failedChecks.length} of ${review.checksRun} checks don't add up. Compare these with the original statements:`}
          </Typography>
          <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
            {review.failedChecks.map((check) => (
              <li key={`${check.fiscalYearEnd}-${check.id}`}>
                {formatYear(check.fiscalYearEnd)}: {check.message}
              </li>
            ))}
          </Box>
        </Alert>
      ) : (
        <Alert severity="success">All {review.checksRun} checks passed.</Alert>
      )}

      {review.unrecognised.length > 0 ? (
        <Alert severity="info">
          <Typography variant="body2" fontWeight={600}>
            These rows weren&apos;t recognised and will be skipped:
          </Typography>
          <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
            {review.unrecognised.map((row) => (
              <li key={row.rowNumber}>Row {row.rowNumber}: {row.label}</li>
            ))}
          </Box>
        </Alert>
      ) : null}

      {comparison ? <ChangeSummary comparison={comparison} /> : null}

      {review.years.length > 0 ? (
        <Stack spacing={1}>
          <ScaleCaption review={review} currency={currency} amountsIn={amountsIn} />
          <StatementTable review={review} comparison={comparison} />
        </Stack>
      ) : null}
    </Stack>
  );
}

const SCALE_MULTIPLIERS = { units: 1, thousands: 1_000, millions: 1_000_000 } as const;

function ScaleCaption({ review, currency, amountsIn }: { review: StatementUploadReview } & ScaleProps) {
  const hasCurrency = /^[A-Z]{1,3}\$?$/.test(currency);

  if (!hasCurrency || !amountsIn) {
    return (
      <Typography variant="body2" sx={{ color: dashboardTokens.textMuted }}>
        Amounts are shown exactly as in your file. Choose the currency and what the figures are in below.
      </Typography>
    );
  }

  const example = statementTableRows(review.years).find((row) => row.values[0] !== null);
  const scaleLabel = amountsIn === "units" ? "" : ` ${amountsIn}`;

  return (
    <Typography variant="body2">
      <strong>Figures in {currency}{scaleLabel}.</strong>
      {example ? (
        <>
          {" "}For example, {example.label.toLowerCase()} of {formatValue(example.values[0], false)} in{" "}
          {formatYear(review.years[0].fiscalYearEnd)} means{" "}
          <strong>{formatMoney(Math.abs(example.values[0]!) * SCALE_MULTIPLIERS[amountsIn], currency)}</strong>.
        </>
      ) : null}
    </Typography>
  );
}

function formatMoney(amount: number, currency: string) {
  const text = (Math.round(amount * 100) / 100).toLocaleString("en-NZ", { maximumFractionDigits: 2 });
  return currency.endsWith("$") ? `${currency}${text}` : `${currency} ${text}`;
}

const MAX_LISTED_CHANGES = 10;
const CHANGED_BACKGROUND = "rgba(245,158,11,0.18)";

const TONE_STYLES = {
  good: { color: dashboardTokens.positive, bgcolor: dashboardTokens.surfaceSoft },
  bad: { color: dashboardTokens.warning, bgcolor: dashboardTokens.surfaceSoft },
  neutral: { color: dashboardTokens.textMuted, bgcolor: dashboardTokens.surfaceAlt },
} as const;

function ChangeBadge({ change, isCost }: { change: YearChange; isCost: boolean }) {
  const arrow = change.direction === "up" ? "▲" : change.direction === "down" ? "▼" : "–";
  const sign = change.amount > 0 ? "+" : change.amount < 0 ? "-" : "";
  // Costs are stored positive, so the amount reads as "this cost went up by".
  const amount = `${sign}${Math.abs(change.amount).toLocaleString("en-NZ", { maximumFractionDigits: 4 })}`;
  const percent = change.percent === null || change.direction === "flat" ? "" : ` (${change.percent > 0 ? "+" : ""}${change.percent}%)`;

  return (
    <Box
      component="span"
      title={isCost ? "A cost: up means it grew" : undefined}
      sx={{ ...TONE_STYLES[change.tone], display: "inline-block", px: 0.75, py: 0.25, borderRadius: 1, whiteSpace: "nowrap", fontWeight: 600 }}
    >
      {arrow} {change.direction === "flat" ? "no change" : `${amount}${percent}`}
    </Box>
  );
}
const CHANGED_TEXT = "#fcd34d";

function ChangeSummary({ comparison }: { comparison: SavedComparison }) {
  const hasChanges =
    comparison.changed.size + comparison.newYears.length + comparison.removedYears.length + comparison.removedLines.length > 0;

  return (
    <Alert severity={hasChanges ? "info" : "success"}>
      <Typography variant="body2" fontWeight={600}>
        Compared with what&apos;s saved: {describeComparison(comparison)}
      </Typography>
      {comparison.changed.size > 0 ? (
        <Typography variant="body2">
          Changed figures are{" "}
          <Box component="span" sx={{ bgcolor: CHANGED_BACKGROUND, color: CHANGED_TEXT, px: 0.5, borderRadius: 0.5 }}>
            highlighted
          </Box>{" "}
          in the table, with the saved figure underneath:
        </Typography>
      ) : null}
      {comparison.changes.length > 0 ? (
        <Box component="ul" sx={{ m: 0, mt: 0.5, pl: 2.5 }}>
          {comparison.changes.slice(0, MAX_LISTED_CHANGES).map((change) => (
            <li key={cellKey(change.label, change.fiscalYearEnd)}>
              {change.label} ({formatYear(change.fiscalYearEnd)}):{" "}
              {change.was === null ? "blank" : formatValue(change.was, change.isCost)} →{" "}
              <strong>{change.now === null ? "blank" : formatValue(change.now, change.isCost)}</strong>
            </li>
          ))}
          {comparison.changes.length > MAX_LISTED_CHANGES ? (
            <li>and {comparison.changes.length - MAX_LISTED_CHANGES} more, highlighted in the table.</li>
          ) : null}
        </Box>
      ) : null}
      {comparison.removedYears.length > 0 || comparison.removedLines.length > 0 ? (
        <Box component="ul" sx={{ m: 0, mt: 0.5, pl: 2.5 }}>
          {comparison.removedYears.map((year) => (
            <li key={year}>{formatYear(year)}: this saved year isn&apos;t in the file and will be removed.</li>
          ))}
          {comparison.removedLines.map((line) => (
            <li key={`${line.label}-${line.fiscalYearEnd}`}>
              {line.label} ({formatYear(line.fiscalYearEnd)}): saved as {line.was}, missing from the file.
            </li>
          ))}
        </Box>
      ) : null}
    </Alert>
  );
}

function StatementTable({ review, comparison }: { review: StatementUploadReview; comparison: SavedComparison | null }) {
  const rows = statementTableRows(review.years);
  // Change compares the latest year (first column) with the one before it.
  const showChange = review.years.length >= 2;

  return (
    <Stack spacing={0.75}>
    {showChange ? (
      <Typography variant="caption" sx={{ color: dashboardTokens.textMuted }}>
        Change compares {formatYear(review.years[0].fiscalYearEnd)} with {formatYear(review.years[1].fiscalYearEnd)}.{" "}
        <Box component="span" sx={{ color: TONE_STYLES.good.color }}>Green: better for the business.</Box>{" "}
        <Box component="span" sx={{ color: TONE_STYLES.bad.color }}>Red: worth a look.</Box>{" "}
        Grey: depends on context.
      </Typography>
    ) : null}
    <TableContainer sx={{ border: "1px solid", borderColor: dashboardTokens.border, borderRadius: 2, maxHeight: 360 }}>
      <Table size="small" stickyHeader>
        <TableHead>
          <TableRow>
            <TableCell>Line</TableCell>
            {review.years.map((year) => (
              <TableCell key={year.fiscalYearEnd} align="right" sx={{ whiteSpace: "nowrap" }}>
                {formatYear(year.fiscalYearEnd)}
                {comparison?.newYears.includes(year.fiscalYearEnd) ? (
                  <Chip label="New" size="small" color="info" sx={{ ml: 1, height: 20 }} />
                ) : null}
              </TableCell>
            ))}
            {showChange ? <TableCell align="right">Change</TableCell> : null}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.label}>
              <TableCell>{row.label}</TableCell>
              {row.values.map((value, index) => {
                const key = cellKey(row.label, review.years[index].fiscalYearEnd);
                const isChanged = Boolean(comparison?.changed.has(key));
                const was = comparison?.changed.get(key) ?? null;

                return (
                  <TableCell
                    key={review.years[index].fiscalYearEnd}
                    align="right"
                    sx={{ fontVariantNumeric: "tabular-nums", ...(isChanged ? { bgcolor: CHANGED_BACKGROUND } : {}) }}
                  >
                    {formatValue(value, row.isCost)}
                    {isChanged ? (
                      <Typography component="span" variant="caption" sx={{ display: "block", color: CHANGED_TEXT }}>
                        was {was === null ? "blank" : formatValue(was, row.isCost)}
                      </Typography>
                    ) : null}
                  </TableCell>
                );
              })}
              {showChange ? (
                <TableCell align="right">
                  {(() => {
                    const change = yearOnYearChange(row.key, row.values[0], row.values[1]);
                    return change ? <ChangeBadge change={change} isCost={row.isCost} /> : "–";
                  })()}
                </TableCell>
              ) : null}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
    </Stack>
  );
}

function formatYear(fiscalYearEnd: string) {
  return new Date(`${fiscalYearEnd}T00:00:00Z`).toLocaleDateString("en-NZ", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatValue(value: number | null, isCost: boolean) {
  if (value === null) return "–";
  const text = Math.abs(value).toLocaleString("en-NZ", { maximumFractionDigits: 4 });
  if (isCost) return `(${text})`;
  return value < 0 ? `-${text}` : text;
}
