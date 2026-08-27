"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Pagination,
  Paper,
  Select,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import { dashboardTokens } from "@/app/theme";
import {
  FINANCIAL_METRIC_KEYS,
  FINANCIAL_METRIC_LABELS,
  isFinancialMetricKey,
} from "@/lib/financial-data";
import type {
  ConfirmDocumentResponse,
  DocumentDetailsResponse,
  DocumentPreviewResponse,
  DocumentReviewCandidate,
  ReviewedDocumentCandidateInput,
} from "@/lib/documents/types";
import { getDocumentStatusPresentation } from "@/lib/documents/presentation";

type CandidateDecision = "pending" | "included" | "excluded";

interface CandidateEdit {
  decision: CandidateDecision;
  metricKey: string;
  value: string;
  currency: string;
  reportingDate: string;
}

interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  error?: { message?: string; details?: unknown };
}

const POLL_INTERVAL_MS = 2500;

function readOriginalValue(candidate: DocumentReviewCandidate, key: string) {
  const value = candidate.original_payload[key];
  if (value === null || value === undefined || value === "") return "Not found";
  return String(value);
}

function candidateEdit(candidate: DocumentReviewCandidate): CandidateEdit {
  return {
    decision: candidate.decision,
    metricKey: candidate.metric_key ?? "",
    value: candidate.value === null ? "" : String(candidate.value),
    currency: candidate.currency ?? "",
    reportingDate: candidate.reporting_date ?? "",
  };
}

function isValidIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function includedCandidateIsValid(edit: CandidateEdit) {
  return (
    edit.decision === "included" &&
    isFinancialMetricKey(edit.metricKey) &&
    edit.value.trim() !== "" &&
    Number.isFinite(Number(edit.value)) &&
    (edit.currency === "NZD" || edit.currency === "AUD") &&
    isValidIsoDate(edit.reportingDate)
  );
}

function evidenceLocation(candidate: DocumentReviewCandidate) {
  const evidence = candidate.evidence;
  const parts: string[] = [];
  if (typeof evidence.sourceSheet === "string") parts.push(`Sheet ${evidence.sourceSheet}`);
  if (typeof evidence.sourcePage === "number") parts.push(`Page ${evidence.sourcePage}`);
  if (typeof evidence.sourceRowStart === "number") {
    const end = evidence.sourceRowEnd;
    parts.push(
      typeof end === "number" && end !== evidence.sourceRowStart
        ? `Rows ${evidence.sourceRowStart}–${end}`
        : `Row ${evidence.sourceRowStart}`,
    );
  }
  return parts.length > 0 ? parts.join(" · ") : "Source location unavailable";
}

function warningMessages(candidate: DocumentReviewCandidate) {
  return candidate.warnings.flatMap((warning) => {
    if (typeof warning === "string") return [warning];
    if (warning && typeof warning === "object" && "message" in warning) {
      const message = Reflect.get(warning, "message");
      return typeof message === "string" ? [message] : [];
    }
    return [];
  });
}

export function DocumentReviewWorkspace({ documentId }: { documentId: string }) {
  const router = useRouter();
  const [details, setDetails] = useState<DocumentDetailsResponse | null>(null);
  const [preview, setPreview] = useState<DocumentPreviewResponse | null>(null);
  const [edits, setEdits] = useState<Record<string, CandidateEdit>>({});
  const [selectedSheets, setSelectedSheets] = useState<string[]>([]);
  const [previewSheet, setPreviewSheet] = useState<string>("");
  const [previewPage, setPreviewPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [previewLoading, setPreviewLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [reprocessing, setReprocessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadDetails = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const response = await fetch(`/api/documents/${encodeURIComponent(documentId)}`);
      const payload = (await response.json()) as ApiEnvelope<DocumentDetailsResponse>;
      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error?.message ?? "Could not load this document.");
      }

      setDetails(payload.data);
      setEdits(
        Object.fromEntries(
          payload.data.candidates.map((candidate) => [candidate.id, candidateEdit(candidate)]),
        ),
      );
      const selected = payload.data.extractionRun?.selected_worksheet_names ?? [];
      setSelectedSheets(selected);
      setPreviewSheet((current) => current || selected[0] || "");
      setError(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not load this document.");
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [documentId]);

  const loadPreview = useCallback(async () => {
    setPreviewLoading(true);
    try {
      const search = new URLSearchParams({ page: String(previewPage), pageSize: "100" });
      if (previewSheet) search.set("sheet", previewSheet);
      const response = await fetch(
        `/api/documents/${encodeURIComponent(documentId)}/preview?${search}`,
      );
      const payload = (await response.json()) as ApiEnvelope<DocumentPreviewResponse>;
      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error?.message ?? "Could not load the original preview.");
      }
      setPreview(payload.data);
    } catch (requestError) {
      setPreview(null);
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not load the original preview.",
      );
    } finally {
      setPreviewLoading(false);
    }
  }, [documentId, previewPage, previewSheet]);

  useEffect(() => {
    void loadDetails();
  }, [loadDetails]);

  useEffect(() => {
    void loadPreview();
  }, [loadPreview]);

  useEffect(() => {
    if (details?.document.status !== "processing") return;
    const interval = window.setInterval(() => void loadDetails(false), POLL_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [details?.document.status, loadDetails]);

  const candidates = useMemo(() => details?.candidates ?? [], [details?.candidates]);
  const confirmed = details?.document.financial_review_status === "confirmed";
  const reviewable = details?.extractionRun?.status === "extracted" && !confirmed;
  const summary = useMemo(() => {
    let included = 0;
    let excluded = 0;
    let pending = 0;
    let invalid = 0;

    for (const candidate of candidates) {
      const edit = edits[candidate.id];
      if (!edit || edit.decision === "pending") pending += 1;
      else if (edit.decision === "excluded") excluded += 1;
      else {
        included += 1;
        if (!includedCandidateIsValid(edit)) invalid += 1;
      }
    }
    return { included, excluded, pending, invalid };
  }, [candidates, edits]);

  const canConfirm =
    reviewable &&
    candidates.length > 0 &&
    summary.pending === 0 &&
    summary.invalid === 0 &&
    !submitting;

  const updateEdit = (candidateId: string, updates: Partial<CandidateEdit>) => {
    setEdits((current) => ({
      ...current,
      [candidateId]: { ...current[candidateId], ...updates },
    }));
  };

  const confirmReview = async () => {
    if (!details?.extractionRun || !canConfirm) return;
    setSubmitting(true);
    setError(null);
    setNotice(null);

    const reviewedCandidates: ReviewedDocumentCandidateInput[] = candidates.map((candidate) => {
      const edit = edits[candidate.id];
      const included = edit.decision === "included";
      return {
        candidateId: candidate.id,
        decision: included ? "included" : "excluded",
        metricKey: included && isFinancialMetricKey(edit.metricKey) ? edit.metricKey : null,
        value: included ? Number(edit.value) : null,
        currency:
          included && (edit.currency === "NZD" || edit.currency === "AUD")
            ? edit.currency
            : null,
        reportingDate: included ? edit.reportingDate : null,
      };
    });

    try {
      const response = await fetch(
        `/api/documents/${encodeURIComponent(documentId)}/confirm`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            extractionRunId: details.extractionRun.id,
            candidates: reviewedCandidates,
          }),
        },
      );
      const payload = (await response.json()) as ApiEnvelope<ConfirmDocumentResponse>;
      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error?.message ?? "Could not confirm this review.");
      }
      setNotice(
        `${payload.data.includedObservationCount} ${payload.data.includedObservationCount === 1 ? "value is" : "values are"} now User-confirmed and available to calculations.`,
      );
      await loadDetails(false);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not confirm this review.");
    } finally {
      setSubmitting(false);
    }
  };

  const reprocess = async () => {
    if (!details) return;
    setReprocessing(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(
        `/api/documents/${encodeURIComponent(documentId)}/reprocess`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            selectedWorksheetNames:
              details.document.file_type === "xlsx" ? selectedSheets : undefined,
          }),
        },
      );
      const payload = (await response.json()) as ApiEnvelope<unknown>;
      if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message ?? "Could not reprocess this document.");
      }
      setNotice("Reprocessing started. Existing User-confirmed values remain available until a new review is approved.");
      await loadDetails(false);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not reprocess this document.");
    } finally {
      setReprocessing(false);
    }
  };

  if (loading) return <ReviewSkeleton />;

  if (!details) {
    return (
      <Stack spacing={2} alignItems="flex-start">
        <Alert severity="error">{error ?? "This document could not be loaded."}</Alert>
        <Button startIcon={<ArrowBackRoundedIcon />} onClick={() => router.push("/dashboard/documents")}>
          Back to documents
        </Button>
      </Stack>
    );
  }

  const worksheetMetadata = details.extractionRun?.worksheet_metadata ?? [];
  const worksheets = worksheetMetadata.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const name = Reflect.get(entry, "name");
    const empty = Reflect.get(entry, "empty");
    return typeof name === "string" ? [{ name, empty: empty === true }] : [];
  });

  return (
    <Stack spacing={2.25}>
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={1.5}>
        <Stack spacing={0.75} sx={{ minWidth: 0 }}>
          <Button
            size="small"
            startIcon={<ArrowBackRoundedIcon />}
            onClick={() => router.push("/dashboard/documents")}
            sx={{ alignSelf: "flex-start" }}
          >
            Documents
          </Button>
          <Typography component="h1" variant="h5" fontWeight={750} sx={{ color: dashboardTokens.text, overflowWrap: "anywhere" }}>
            {details.document.file_name}
          </Typography>
          <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
            <Chip size="small" label={details.document.file_type.toUpperCase()} />
            <ReviewStatusChip details={details} />
            {details.document.status === "processing" ? <CircularProgress size={20} aria-label="Processing document" /> : null}
          </Stack>
        </Stack>
        <Button
          variant="outlined"
          startIcon={<RefreshRoundedIcon />}
          disabled={reprocessing || details.document.status === "processing" || (details.document.file_type === "xlsx" && selectedSheets.length === 0)}
          onClick={() => void reprocess()}
          sx={{ alignSelf: { xs: "stretch", sm: "center" } }}
        >
          {reprocessing ? "Starting…" : "Reprocess document"}
        </Button>
      </Stack>

      {error ? <Alert severity="error" onClose={() => setError(null)}>{error}</Alert> : null}
      {notice ? <Alert severity="success" onClose={() => setNotice(null)}>{notice}</Alert> : null}
      {details.document.status === "failed" ? (
        <Alert severity="error">
          {details.document.error_message ?? "Document extraction failed. The original is still stored and can be previewed or reprocessed."}
        </Alert>
      ) : null}
      {details.document.status === "processing" ? (
        <Alert severity="info" icon={<CircularProgress size={18} />}>
          Processing the original now. This page will update automatically.
        </Alert>
      ) : null}
      {confirmed ? (
        <Alert severity="success" icon={<CheckCircleRoundedIcon />}>
          These included values are User-confirmed and available to dashboards, forecasts, scenarios, and deterministic tools.
        </Alert>
      ) : null}

      {details.document.file_type === "xlsx" && worksheets.length > 0 ? (
        <Paper variant="outlined" sx={panelStyles}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} alignItems={{ md: "center" }}>
            <Stack sx={{ flex: 1 }}>
              <Typography fontWeight={700}>Worksheets to extract</Typography>
              <Typography variant="body2" sx={{ color: dashboardTokens.textMuted }}>
                AI-BOSS suggests likely financial sheets. Select one or more, then reprocess to create a new review run.
              </Typography>
            </Stack>
            <FormControl size="small" sx={{ minWidth: { xs: "100%", md: 320 } }}>
              <InputLabel id="worksheet-selection-label">Worksheets</InputLabel>
              <Select
                labelId="worksheet-selection-label"
                multiple
                label="Worksheets"
                value={selectedSheets}
                renderValue={(values) => values.join(", ")}
                onChange={(event) => setSelectedSheets(
                  typeof event.target.value === "string" ? event.target.value.split(",") : event.target.value,
                )}
              >
                {worksheets.map((sheet) => (
                  <MenuItem key={sheet.name} value={sheet.name} disabled={sheet.empty}>
                    <Checkbox checked={selectedSheets.includes(sheet.name)} />
                    {sheet.name}{sheet.empty ? " (empty)" : ""}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>
        </Paper>
      ) : null}

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "minmax(0, 1fr) minmax(420px, 0.9fr)" }, gap: 2, alignItems: "start" }}>
        <OriginalPreview
          preview={preview}
          loading={previewLoading}
          selectedSheet={previewSheet}
          onSheetChange={(sheetName) => { setPreviewSheet(sheetName); setPreviewPage(1); }}
          onPageChange={setPreviewPage}
        />

        <Stack spacing={1.5} sx={{ minWidth: 0 }}>
          <Paper variant="outlined" sx={panelStyles}>
            <Typography component="h2" variant="h6" fontWeight={750}>Extraction review</Typography>
            <Typography variant="body2" sx={{ mt: 0.5, color: dashboardTokens.textMuted }}>
              Compare every candidate with the original. Choose Include or Exclude, and correct any included value before approval.
            </Typography>
          </Paper>

          {candidates.length === 0 ? (
            <Paper variant="outlined" sx={{ ...panelStyles, textAlign: "center", py: 6 }}>
              <Typography fontWeight={700}>No financial metrics found</Typography>
              <Typography variant="body2" sx={{ mt: 0.75, color: dashboardTokens.textMuted }}>
                {details.document.file_type === "pdf"
                  ? "The original remains available as evidence. If this is a scanned PDF, OCR extraction is not available."
                  : "Try different worksheets or reprocess after checking the file layout."}
              </Typography>
            </Paper>
          ) : (
            candidates.map((candidate, index) => (
              <CandidateReviewCard
                key={candidate.id}
                candidate={candidate}
                index={index}
                edit={edits[candidate.id]}
                readOnly={!reviewable}
                onChange={(updates) => updateEdit(candidate.id, updates)}
              />
            ))
          )}

          {candidates.length > 0 ? (
            <Paper
              component="aside"
              variant="outlined"
              sx={{ ...panelStyles, position: { lg: "sticky" }, bottom: { lg: 16 }, zIndex: 2, boxShadow: "0 14px 38px rgba(0,0,0,0.32)" }}
            >
              <Stack spacing={1.25}>
                <Stack direction="row" justifyContent="space-between" spacing={2}>
                  <Typography fontWeight={750}>Review summary</Typography>
                  <Typography variant="body2" sx={{ color: dashboardTokens.textMuted }}>
                    {summary.included} include · {summary.excluded} exclude · {summary.pending} undecided
                  </Typography>
                </Stack>
                {summary.invalid > 0 ? (
                  <Alert severity="warning">
                    {summary.invalid} included {summary.invalid === 1 ? "candidate needs" : "candidates need"} a valid metric, value, NZD/AUD currency, and reporting date.
                  </Alert>
                ) : null}
                {summary.pending > 0 && reviewable ? (
                  <Alert severity="info">Choose Include or Exclude for every candidate.</Alert>
                ) : null}
                <Button
                  fullWidth
                  variant="contained"
                  size="large"
                  disabled={!canConfirm}
                  onClick={() => void confirmReview()}
                >
                  {submitting ? "Confirming…" : confirmed ? "Values are User-confirmed" : "Use these values in AI-BOSS."}
                </Button>
                <Typography variant="caption" sx={{ color: dashboardTokens.textMuted }}>
                  Until approval, extracted candidates are unreviewed evidence and cannot be used in calculations.
                </Typography>
              </Stack>
            </Paper>
          ) : null}
        </Stack>
      </Box>
    </Stack>
  );
}

function ReviewStatusChip({ details }: { details: DocumentDetailsResponse }) {
  const presentation = getDocumentStatusPresentation(details.document);
  return (
    <Chip
      size="small"
      label={presentation.label}
      variant="outlined"
      sx={{ color: presentation.color, borderColor: presentation.borderColor }}
    />
  );
}

function OriginalPreview({
  preview,
  loading,
  selectedSheet,
  onSheetChange,
  onPageChange,
}: {
  preview: DocumentPreviewResponse | null;
  loading: boolean;
  selectedSheet: string;
  onSheetChange: (sheetName: string) => void;
  onPageChange: (page: number) => void;
}) {
  return (
    <Paper variant="outlined" sx={{ ...panelStyles, minWidth: 0 }}>
      <Stack spacing={1.5}>
        <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={1}>
          <Stack>
            <Typography component="h2" variant="h6" fontWeight={750}>Original document</Typography>
            <Typography variant="body2" sx={{ color: dashboardTokens.textMuted }}>
              Preview only. The stored original is never changed by corrections.
            </Typography>
          </Stack>
          {preview?.type === "table" && preview.availableSheets.length > 1 ? (
            <FormControl size="small" sx={{ minWidth: 190 }}>
              <InputLabel id="preview-sheet-label">Preview sheet</InputLabel>
              <Select
                labelId="preview-sheet-label"
                label="Preview sheet"
                value={selectedSheet || preview.sheetName}
                onChange={(event) => onSheetChange(event.target.value)}
              >
                {preview.availableSheets.map((sheet) => (
                  <MenuItem key={sheet.name} value={sheet.name} disabled={sheet.empty}>
                    {sheet.name}{sheet.suggested ? " · Suggested" : ""}{sheet.empty ? " · Empty" : ""}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          ) : null}
        </Stack>

        {loading ? (
          <Stack spacing={1}><Skeleton height={44} /><Skeleton variant="rounded" height={480} /></Stack>
        ) : preview?.type === "pdf" ? (
          <Box
            component="iframe"
            src={preview.url}
            title="Original PDF preview"
            sx={{ width: "100%", minHeight: { xs: 520, md: 720 }, border: "1px solid", borderColor: dashboardTokens.border, borderRadius: 1.5, bgcolor: "white" }}
          />
        ) : preview?.type === "table" ? (
          <>
            {preview.totalColumnCount > preview.displayedColumnCount ? (
              <Alert severity="info">Showing the first {preview.displayedColumnCount} of {preview.totalColumnCount} columns.</Alert>
            ) : null}
            {preview.warnings.length > 0 ? (
              <Alert severity="warning">{preview.warnings.length} worksheet warning{preview.warnings.length === 1 ? "" : "s"}. Review formula and formatting notes beside extracted candidates.</Alert>
            ) : null}
            <TableContainer sx={{ maxHeight: 680, border: "1px solid", borderColor: dashboardTokens.border, borderRadius: 1.5 }}>
              <Table stickyHeader size="small" aria-label={`${preview.sheetName} original table preview`}>
                <TableHead><TableRow><TableCell sx={{ minWidth: 70 }}>Row</TableCell>{preview.headers.map((header, index) => <TableCell key={`${header}-${index}`} sx={{ minWidth: 130 }}>{header}</TableCell>)}</TableRow></TableHead>
                <TableBody>
                  {preview.rows.map((row) => (
                    <TableRow key={row.rowNumber} hover>
                      <TableCell component="th" scope="row">{row.rowNumber}</TableCell>
                      {preview.headers.map((_, index) => <TableCell key={index}>{row.values[index] || "—"}</TableCell>)}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            <Stack direction={{ xs: "column", sm: "row" }} alignItems="center" justifyContent="space-between" spacing={1}>
              <Typography variant="caption" sx={{ color: dashboardTokens.textMuted }}>
                {preview.totalRows} rows · up to {preview.pageSize} per page
              </Typography>
              <Pagination
                page={preview.page}
                count={preview.totalPages}
                onChange={(_, page) => onPageChange(page)}
                color="primary"
                size="small"
              />
            </Stack>
          </>
        ) : (
          <Alert severity="warning">The original preview is unavailable right now.</Alert>
        )}
      </Stack>
    </Paper>
  );
}

function CandidateReviewCard({
  candidate,
  index,
  edit,
  readOnly,
  onChange,
}: {
  candidate: DocumentReviewCandidate;
  index: number;
  edit: CandidateEdit;
  readOnly: boolean;
  onChange: (updates: Partial<CandidateEdit>) => void;
}) {
  const warnings = warningMessages(candidate);
  const invalidIncluded = edit.decision === "included" && !includedCandidateIsValid(edit);
  const excerpt = typeof candidate.evidence.excerpt === "string" ? candidate.evidence.excerpt : null;

  return (
    <Paper component="article" variant="outlined" sx={{ ...panelStyles, borderColor: invalidIncluded ? "rgba(251,191,36,0.55)" : dashboardTokens.border }}>
      <Stack spacing={1.5}>
        <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={1}>
          <Stack>
            <Typography fontWeight={750}>Candidate {index + 1}</Typography>
            <Typography variant="caption" sx={{ color: dashboardTokens.textMuted }}>
              {evidenceLocation(candidate)} · {candidate.confidence === null ? "Confidence unavailable" : `${Math.round(candidate.confidence * 100)}% confidence`}
            </Typography>
          </Stack>
          <ToggleButtonGroup
            exclusive
            size="small"
            value={edit.decision === "pending" ? null : edit.decision}
            onChange={(_, value: "included" | "excluded" | null) => value && onChange({ decision: value })}
            aria-label={`Candidate ${index + 1} decision`}
            disabled={readOnly}
          >
            <ToggleButton value="included" color="success" aria-label={`Include candidate ${index + 1}`}>Include</ToggleButton>
            <ToggleButton value="excluded" color="error" aria-label={`Exclude candidate ${index + 1}`}>Exclude</ToggleButton>
          </ToggleButtonGroup>
        </Stack>

        {excerpt ? <Box component="blockquote" sx={{ m: 0, px: 1.5, py: 1, borderLeft: "3px solid", borderColor: dashboardTokens.accent, bgcolor: "rgba(79,125,243,0.08)", color: dashboardTokens.textSoft, fontSize: 13 }}>{excerpt}</Box> : null}

        {warnings.length > 0 ? (
          <Alert severity="warning" icon={<WarningAmberRoundedIcon />}>
            {warnings.join(" ")}
          </Alert>
        ) : null}

        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" }, gap: 1 }}>
          <OriginalField label="Original metric" value={readOriginalValue(candidate, "metricKey")} />
          <FormControl size="small" fullWidth disabled={readOnly || edit.decision === "excluded"} error={invalidIncluded && !isFinancialMetricKey(edit.metricKey)}>
            <InputLabel id={`metric-${candidate.id}`}>Corrected metric</InputLabel>
            <Select labelId={`metric-${candidate.id}`} label="Corrected metric" value={edit.metricKey} onChange={(event) => onChange({ metricKey: event.target.value })}>
              {FINANCIAL_METRIC_KEYS.map((key) => <MenuItem key={key} value={key}>{FINANCIAL_METRIC_LABELS[key]}</MenuItem>)}
            </Select>
          </FormControl>
          <OriginalField label="Original value" value={readOriginalValue(candidate, "value")} />
          <TextField size="small" label="Corrected value" inputMode="decimal" value={edit.value} disabled={readOnly || edit.decision === "excluded"} error={invalidIncluded && (edit.value.trim() === "" || !Number.isFinite(Number(edit.value)))} onChange={(event) => onChange({ value: event.target.value })} />
          <OriginalField label="Original currency" value={readOriginalValue(candidate, "currency")} />
          <FormControl size="small" fullWidth disabled={readOnly || edit.decision === "excluded"} error={invalidIncluded && edit.currency !== "NZD" && edit.currency !== "AUD"}>
            <InputLabel id={`currency-${candidate.id}`}>Corrected currency</InputLabel>
            <Select labelId={`currency-${candidate.id}`} label="Corrected currency" value={edit.currency} onChange={(event) => onChange({ currency: event.target.value })}>
              <MenuItem value="NZD">NZD</MenuItem><MenuItem value="AUD">AUD</MenuItem>
            </Select>
          </FormControl>
          <OriginalField label="Original reporting date" value={readOriginalValue(candidate, "asOfDate") !== "Not found" ? readOriginalValue(candidate, "asOfDate") : readOriginalValue(candidate, "periodEnd")} />
          <TextField size="small" type="date" label="Corrected reporting date" value={edit.reportingDate} disabled={readOnly || edit.decision === "excluded"} error={invalidIncluded && !isValidIsoDate(edit.reportingDate)} onChange={(event) => onChange({ reportingDate: event.target.value })} slotProps={{ inputLabel: { shrink: true } }} />
        </Box>
      </Stack>
    </Paper>
  );
}

function OriginalField({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ px: 1.5, py: 1, borderRadius: 1.5, border: "1px solid", borderColor: dashboardTokens.border, bgcolor: "rgba(255,255,255,0.025)" }}>
      <Typography variant="caption" sx={{ color: dashboardTokens.textMuted }}>{label}</Typography>
      <Typography variant="body2" sx={{ mt: 0.25, color: dashboardTokens.textSoft, overflowWrap: "anywhere" }}>{value}</Typography>
    </Box>
  );
}

function ReviewSkeleton() {
  return (
    <Stack spacing={2} aria-label="Loading document review">
      <Skeleton width="45%" height={52} />
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1fr 0.9fr" }, gap: 2 }}>
        <Skeleton variant="rounded" height={680} />
        <Stack spacing={1.5}><Skeleton variant="rounded" height={120} /><Skeleton variant="rounded" height={420} /></Stack>
      </Box>
    </Stack>
  );
}

const panelStyles = {
  p: { xs: 1.5, sm: 2 },
  borderRadius: 2.5,
  borderColor: dashboardTokens.border,
  bgcolor: dashboardTokens.surface,
};
