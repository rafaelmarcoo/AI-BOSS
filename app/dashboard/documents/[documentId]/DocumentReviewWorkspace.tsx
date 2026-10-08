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
  Divider,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
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
  Tab,
  Tabs,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import AddCircleOutlineRoundedIcon from "@mui/icons-material/AddCircleOutlineRounded";
import SaveRoundedIcon from "@mui/icons-material/SaveRounded";
import { dashboardCanvasTokens as dashboardTokens } from "@/app/theme";
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
import {
  buildItemMatrix,
  readExtractedItemsWithIndex,
} from "@/lib/financial-data/item-matrix";
import {
  DOCUMENT_CATEGORY_LABELS,
  normalizeDocumentCategory,
} from "@/lib/documents/categories";

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
  const edit: CandidateEdit = {
    decision: candidate.decision,
    metricKey: candidate.metric_key ?? "",
    value: candidate.value === null ? "" : String(candidate.value),
    currency: candidate.metric_key === "runway_months" ? "" : candidate.currency ?? "",
    reportingDate: candidate.reporting_date ?? "",
  };

  if (candidate.decision === "pending" && candidateFieldsAreValid(edit)) {
    return { ...edit, decision: "included" };
  }

  return edit;
}

function isValidIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function candidateFieldsAreValid(edit: CandidateEdit) {
  const hasValidUnit =
    edit.metricKey === "runway_months"
      ? edit.currency === ""
      : edit.currency === "NZD" || edit.currency === "AUD";

  return (
    isFinancialMetricKey(edit.metricKey) &&
    edit.value.trim() !== "" &&
    Number.isFinite(Number(edit.value)) &&
    hasValidUnit &&
    isValidIsoDate(edit.reportingDate)
  );
}

function includedCandidateIsValid(edit: CandidateEdit) {
  return edit.decision === "included" && candidateFieldsAreValid(edit);
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

function metadataValue(metadata: unknown, key: string) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return undefined;
  return Reflect.get(metadata, key);
}

function extractionMethodLabel(metadata: unknown) {
  const value = metadataValue(metadata, "extractionMethod");
  if (value === "ai_assisted") return "AI-assisted extraction";
  if (value === "hybrid") return "Deterministic + AI extraction";
  return "Deterministic extraction";
}

function emptyExtractionMessage(metadata: unknown, itemCount: number) {
  if (itemCount > 0) {
    return `${itemCount} supporting ${itemCount === 1 ? "item was" : "items were"} extracted. Review Items and create a calculation value when the source supports one.`;
  }
  const warnings = metadataValue(metadata, "extractionWarnings");
  const codes = Array.isArray(warnings)
    ? warnings.map((warning) =>
        warning && typeof warning === "object" ? Reflect.get(warning, "code") : null,
      )
    : [];
  if (codes.includes("ai_assisted_unavailable")) {
    return "AI-assisted extraction is not configured. The original remains stored and previewable.";
  }
  if (codes.includes("ai_assisted_failed")) {
    return "AI-assisted extraction could not read calculation-ready values. The original remains stored and can be reprocessed.";
  }
  return "No calculation-ready values were found. The original and any recovered transcription remain available as evidence.";
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
  const [savingDraft, setSavingDraft] = useState(false);
  const [reprocessing, setReprocessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [reviewAcknowledged, setReviewAcknowledged] = useState(false);
  const [reviewSection, setReviewSection] = useState<"values" | "items">("values");

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
      setReviewAcknowledged(false);
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
  const itemCount = useMemo(
    () => readExtractedItemsWithIndex(details?.document.metadata).length,
    [details?.document.metadata],
  );
  const confirmed = details?.document.financial_review_status === "confirmed";
  const reviewable = details?.extractionRun?.status === "extracted" && !confirmed;

  useEffect(() => {
    if (details && candidates.length === 0 && itemCount > 0) {
      setReviewSection("items");
    }
  }, [candidates.length, details, itemCount]);
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
    details?.document.access.canConfirm === true &&
    candidates.length > 0 &&
    summary.pending === 0 &&
    summary.invalid === 0 &&
    reviewAcknowledged &&
    !submitting;

  const canSaveDraft =
    reviewable &&
    details?.document.access.canSaveDraft === true &&
    candidates.length > 0 &&
    !savingDraft;

  const updateEdit = (candidateId: string, updates: Partial<CandidateEdit>) => {
    setReviewAcknowledged(false);
    setEdits((current) => ({
      ...current,
      [candidateId]: { ...current[candidateId], ...updates },
    }));
  };

  const setAllCandidateDecisions = (
    decision: "included_valid" | "excluded" | "pending",
  ) => {
    setReviewAcknowledged(false);
    setEdits((current) => Object.fromEntries(
      candidates.map((candidate) => {
        const edit = current[candidate.id] ?? candidateEdit(candidate);
        const nextDecision: CandidateDecision =
          decision === "included_valid"
            ? candidateFieldsAreValid(edit) ? "included" : "pending"
            : decision;
        return [candidate.id, { ...edit, decision: nextDecision }];
      }),
    ));
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
          included && edit.metricKey !== "runway_months" &&
          (edit.currency === "NZD" || edit.currency === "AUD")
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

  const saveDraft = async () => {
    if (!details?.extractionRun || !canSaveDraft) return;
    setSavingDraft(true);
    setError(null);
    setNotice(null);

    const draftCandidates = candidates.map((candidate) => {
      const edit = edits[candidate.id];
      return {
        candidateId: candidate.id,
        decision: edit.decision,
        metricKey: isFinancialMetricKey(edit.metricKey) ? edit.metricKey : null,
        value:
          edit.value.trim() !== "" && Number.isFinite(Number(edit.value))
            ? Number(edit.value)
            : null,
        currency:
          edit.metricKey !== "runway_months" &&
          (edit.currency === "NZD" || edit.currency === "AUD")
            ? edit.currency
            : null,
        reportingDate: isValidIsoDate(edit.reportingDate) ? edit.reportingDate : null,
      };
    });

    try {
      const response = await fetch(
        `/api/documents/${encodeURIComponent(documentId)}/review`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            extractionRunId: details.extractionRun.id,
            candidates: draftCandidates,
          }),
        },
      );
      const payload = (await response.json()) as ApiEnvelope<{ saved: boolean }>;
      if (!response.ok || !payload.success || !payload.data?.saved) {
        throw new Error(payload.error?.message ?? "Could not save this review draft.");
      }
      setNotice(
        details.document.access.canConfirm
          ? "Review draft saved. It has not been published to company calculations."
          : "Review draft saved for a company administrator to approve.",
      );
      await loadDetails(false);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not save this review draft.");
    } finally {
      setSavingDraft(false);
    }
  };

  const reprocess = async (extractionMode: "auto" | "ai_assisted" = "auto") => {
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
            extractionMode,
          }),
        },
      );
      const payload = (await response.json()) as ApiEnvelope<unknown>;
      if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message ?? "Could not reprocess this document.");
      }
      setNotice(
        `${extractionMode === "ai_assisted" ? "AI-assisted reprocessing" : "Reprocessing"} started. Existing User-confirmed values remain available until a new review is approved.`,
      );
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
            <Chip
              size="small"
              label={DOCUMENT_CATEGORY_LABELS[
                normalizeDocumentCategory(details.document.document_type, details.document.file_type)
              ]}
              variant="outlined"
            />
            <Chip size="small" label={extractionMethodLabel(details.document.metadata)} variant="outlined" />
            <ReviewStatusChip details={details} />
            {details.document.status === "processing" ? <CircularProgress size={20} aria-label="Processing document" /> : null}
          </Stack>
        </Stack>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ alignSelf: { sm: "center" } }}>
          <Button
            variant="outlined"
            startIcon={<RefreshRoundedIcon />}
            disabled={reprocessing || details.document.status === "processing" || (details.document.file_type === "xlsx" && selectedSheets.length === 0)}
            onClick={() => void reprocess()}
          >
            {reprocessing ? "Starting…" : "Reprocess document"}
          </Button>
          {["pdf", "csv", "xlsx", "text", "docx"].includes(details.document.file_type) ? (
            <Button
              variant="text"
              disabled={reprocessing || details.document.status === "processing"}
              onClick={() => void reprocess("ai_assisted")}
            >
              Try AI-assisted extraction
            </Button>
          ) : null}
        </Stack>
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
      {!confirmed && !details.document.access.canConfirm ? (
        <Alert severity="info">
          You can prepare and save this review. A company administrator must approve it before the values can be used in financial calculations.
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
            <Stack spacing={1.25}>
              <Stack>
                <Typography component="h2" variant="h6" fontWeight={750}>Extraction review</Typography>
                <Typography variant="body2" sx={{ mt: 0.5, color: dashboardTokens.textMuted }}>
                  {reviewSection === "values"
                    ? "Compare candidate financial values with the original, correct them, and explicitly confirm the final selection."
                    : "Review supplementary line items and attributes. These notes never become trusted calculation inputs."}
                </Typography>
              </Stack>
              <Tabs
                value={reviewSection}
                onChange={(_, value: "values" | "items") => setReviewSection(value)}
                aria-label="Document review sections"
                variant="fullWidth"
              >
                <Tab value="values" label={`Values (${candidates.length})`} />
                <Tab value="items" label={`Items (${itemCount})`} />
              </Tabs>
              {reviewSection === "values" && reviewable && details.document.access.canSaveDraft && candidates.length > 0 ? (
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                  <Button variant="outlined" size="small" onClick={() => setAllCandidateDecisions("included_valid")}>
                    Include all valid
                  </Button>
                  <Button variant="outlined" color="error" size="small" onClick={() => setAllCandidateDecisions("excluded")}>
                    Exclude all
                  </Button>
                  <Button variant="text" size="small" onClick={() => setAllCandidateDecisions("pending")}>
                    Clear selections
                  </Button>
                </Stack>
              ) : null}
            </Stack>
          </Paper>

          {reviewSection === "values" ? (
            <>
          {candidates.length === 0 ? (
            <Paper variant="outlined" sx={{ ...panelStyles, textAlign: "center", py: 6 }}>
              <Typography fontWeight={700}>No financial metrics found</Typography>
              <Typography variant="body2" sx={{ mt: 0.75, color: dashboardTokens.textMuted }}>
                {emptyExtractionMessage(details.document.metadata, itemCount)}
              </Typography>
            </Paper>
          ) : (
            candidates.map((candidate, index) => (
              <CandidateReviewCard
                key={candidate.id}
                candidate={candidate}
                index={index}
                edit={edits[candidate.id]}
                readOnly={!reviewable || !details.document.access.canSaveDraft}
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
                    {summary.invalid} included {summary.invalid === 1 ? "candidate needs" : "candidates need"} a valid metric, value, reporting date, and NZD/AUD currency for monetary metrics.
                  </Alert>
                ) : null}
                {summary.pending > 0 && reviewable ? (
                  <Alert severity="info">Choose Include or Exclude for every candidate.</Alert>
                ) : null}
                {reviewable && details.document.access.canConfirm ? (
                  <FormControlLabel
                    control={(
                      <Checkbox
                        checked={reviewAcknowledged}
                        onChange={(event) => setReviewAcknowledged(event.target.checked)}
                      />
                    )}
                    label="I reviewed these values against the original document."
                  />
                ) : null}
                {reviewable && details.document.access.canSaveDraft ? (
                  <Button
                    fullWidth
                    variant={details.document.access.canConfirm ? "outlined" : "contained"}
                    disabled={!canSaveDraft}
                    onClick={() => void saveDraft()}
                  >
                    {savingDraft ? "Saving…" : "Save review draft"}
                  </Button>
                ) : null}
                {details.document.access.canConfirm ? (
                  <Button
                    fullWidth
                    variant="contained"
                    size="large"
                    disabled={!canConfirm}
                    onClick={() => void confirmReview()}
                  >
                    {submitting ? "Confirming…" : confirmed ? "Values are User-confirmed" : "Approve for company calculations"}
                  </Button>
                ) : null}
                <Typography variant="caption" sx={{ color: dashboardTokens.textMuted }}>
                  Until approval, extracted candidates are unreviewed evidence and cannot be used in calculations.
                </Typography>
              </Stack>
            </Paper>
          ) : null}
            </>
          ) : (
            <SupplementaryItemsPanel
              documentId={documentId}
              extractionRunId={details.extractionRun?.id ?? null}
              metadata={details.document.metadata}
              editable={details.document.access.canSaveDraft}
              canPromote={reviewable && details.document.access.canSaveDraft}
              onSaved={() => loadDetails(false)}
              onPromoted={() => setReviewSection("values")}
              onError={setError}
              onNotice={setNotice}
            />
          )}
        </Stack>
      </Box>
    </Stack>
  );
}

interface ItemDraft {
  value: string;
  attributes: Record<string, string>;
}

function metadataCurrency(metadata: unknown): "NZD" | "AUD" {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return "NZD";
  return Reflect.get(metadata, "itemCurrency") === "AUD" ? "AUD" : "NZD";
}

function SupplementaryItemsPanel({
  documentId,
  extractionRunId,
  metadata,
  editable,
  canPromote,
  onSaved,
  onPromoted,
  onError,
  onNotice,
}: {
  documentId: string;
  extractionRunId: string | null;
  metadata: unknown;
  editable: boolean;
  canPromote: boolean;
  onSaved: () => Promise<void>;
  onPromoted: () => void;
  onError: (message: string | null) => void;
  onNotice: (message: string | null) => void;
}) {
  const matrix = useMemo(
    () => buildItemMatrix(readExtractedItemsWithIndex(metadata)),
    [metadata],
  );
  const [drafts, setDrafts] = useState<Record<number, ItemDraft>>({});
  const [customColumns, setCustomColumns] = useState<string[]>([]);
  const [newColumn, setNewColumn] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newValue, setNewValue] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newQuantity, setNewQuantity] = useState("");
  const [currency, setCurrency] = useState<"NZD" | "AUD">(
    metadataCurrency(metadata),
  );
  const [savingRow, setSavingRow] = useState<number | "new" | "currency" | null>(null);
  const [selectedIndexes, setSelectedIndexes] = useState<Set<number>>(new Set());
  const [promotionOpen, setPromotionOpen] = useState(false);
  const [promotionMetric, setPromotionMetric] = useState("");
  const [promotionCurrency, setPromotionCurrency] = useState<"NZD" | "AUD">(
    metadataCurrency(metadata),
  );
  const [promotionDate, setPromotionDate] = useState("");
  const [promoting, setPromoting] = useState(false);

  useEffect(() => {
    setDrafts(Object.fromEntries(matrix.rows.map((row) => [
      row.index,
      {
        value: String(row.value),
        attributes: Object.fromEntries(
          Object.entries(row.attributes).map(([key, value]) => [key, String(value)]),
        ),
      },
    ])));
    setCurrency(metadataCurrency(metadata));
    setPromotionCurrency(metadataCurrency(metadata));
    setSelectedIndexes((current) => new Set(
      [...current].filter((index) => matrix.rows.some((row) => row.index === index)),
    ));
  }, [matrix.rows, metadata]);

  const columns = [...matrix.columns];
  for (const column of customColumns) {
    if (!columns.includes(column)) columns.push(column);
  }

  const request = async (path: string, body: unknown, method: "POST" | "PATCH") => {
    const response = await fetch(path, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = (await response.json()) as ApiEnvelope<unknown>;
    if (!response.ok || !payload.success) {
      throw new Error(payload.error?.message ?? "Could not save the item changes.");
    }
  };

  const saveRow = async (index: number) => {
    const draft = drafts[index];
    const value = Number(draft?.value);
    if (!draft || draft.value.trim() === "" || !Number.isFinite(value)) {
      onError("Each item value must be a valid number.");
      return;
    }

    setSavingRow(index);
    onError(null);
    try {
      await request(
        `/api/documents/${encodeURIComponent(documentId)}/items`,
        { index, value, attributes: draft.attributes },
        "PATCH",
      );
      await onSaved();
      onNotice("Supplementary item saved. Trusted financial values were not changed.");
    } catch (requestError) {
      onError(requestError instanceof Error ? requestError.message : "Could not save the item.");
    } finally {
      setSavingRow(null);
    }
  };

  const addItem = async () => {
    if (!newLabel.trim()) {
      onError("Enter a label for the new item.");
      return;
    }
    const attributes: Record<string, string> = {};
    if (newPrice.trim()) attributes.price = newPrice;
    if (newQuantity.trim()) attributes.quantity = newQuantity;
    const parsedValue = newValue.trim() === "" ? undefined : Number(newValue);
    if (parsedValue !== undefined && !Number.isFinite(parsedValue)) {
      onError("The new item value must be a valid number.");
      return;
    }

    setSavingRow("new");
    onError(null);
    try {
      await request(
        `/api/documents/${encodeURIComponent(documentId)}/items`,
        { label: newLabel.trim(), value: parsedValue, attributes },
        "POST",
      );
      setNewLabel("");
      setNewValue("");
      setNewPrice("");
      setNewQuantity("");
      await onSaved();
      onNotice("Supplementary item added. Price × quantity is used when value is blank.");
    } catch (requestError) {
      onError(requestError instanceof Error ? requestError.message : "Could not add the item.");
    } finally {
      setSavingRow(null);
    }
  };

  const saveCurrency = async (nextCurrency: "NZD" | "AUD") => {
    setCurrency(nextCurrency);
    setSavingRow("currency");
    onError(null);
    try {
      await request(
        `/api/documents/${encodeURIComponent(documentId)}/currency`,
        { currency: nextCurrency },
        "PATCH",
      );
      await onSaved();
      onNotice("Supplementary item currency saved. Confirmed metric currencies were not changed.");
    } catch (requestError) {
      onError(requestError instanceof Error ? requestError.message : "Could not save the currency.");
    } finally {
      setSavingRow(null);
    }
  };

  const selectedRows = matrix.rows.filter((row) => selectedIndexes.has(row.index));
  const selectedTotal = Math.round(
    (selectedRows.reduce((total, row) => total + row.value, 0) + Number.EPSILON) * 100,
  ) / 100;

  const promoteItems = async () => {
    if (!extractionRunId || selectedRows.length === 0 || !promotionMetric || !promotionDate) {
      onError("Choose Items, a metric, currency, and reporting date.");
      return;
    }
    setPromoting(true);
    onError(null);
    try {
      await request(
        `/api/documents/${encodeURIComponent(documentId)}/candidates/from-items`,
        {
          extractionRunId,
          itemIndexes: selectedRows.map((row) => row.index),
          metricKey: promotionMetric,
          currency: promotionCurrency,
          reportingDate: promotionDate,
        },
        "POST",
      );
      setPromotionOpen(false);
      setPromotionMetric("");
      setPromotionDate("");
      setSelectedIndexes(new Set());
      await onSaved();
      onPromoted();
      onNotice(
        `Created a pending calculation value of ${promotionCurrency} ${selectedTotal.toLocaleString()}. Review and approve it before calculations can use it.`,
      );
    } catch (requestError) {
      onError(requestError instanceof Error ? requestError.message : "Could not create the calculation value.");
    } finally {
      setPromoting(false);
    }
  };

  return (
    <Paper variant="outlined" sx={panelStyles}>
      <Stack spacing={2}>
        <Alert severity="info">
          Items are supporting document metadata only. Select one or more and create a calculation value when the original supports grouping them. Nothing affects calculations until administrator approval.
        </Alert>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} justifyContent="space-between">
          <FormControl size="small" sx={{ minWidth: 150 }} disabled={!editable || savingRow !== null}>
            <InputLabel id="item-currency-label">Item currency</InputLabel>
            <Select
              labelId="item-currency-label"
              label="Item currency"
              value={currency}
              onChange={(event) => void saveCurrency(event.target.value as "NZD" | "AUD")}
            >
              <MenuItem value="NZD">NZD</MenuItem>
              <MenuItem value="AUD">AUD</MenuItem>
            </Select>
          </FormControl>
          {editable ? (
            <Stack direction="row" spacing={1}>
              <TextField
                size="small"
                label="New attribute column"
                value={newColumn}
                onChange={(event) => setNewColumn(event.target.value)}
              />
              <Button
                variant="outlined"
                startIcon={<AddCircleOutlineRoundedIcon />}
                onClick={() => {
                  const column = newColumn.trim();
                  if (column && !columns.includes(column)) setCustomColumns((current) => [...current, column]);
                  setNewColumn("");
                }}
              >
                Add column
              </Button>
            </Stack>
          ) : null}
        </Stack>

        {matrix.rows.length === 0 ? (
          <Typography variant="body2" sx={{ color: dashboardTokens.textMuted }}>
            No supplementary items were extracted. You can add rows manually without affecting trusted financial values.
          </Typography>
        ) : (
          <Stack spacing={1.25}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} justifyContent="space-between" alignItems={{ sm: "center" }}>
            <Typography variant="body2" sx={{ color: dashboardTokens.textMuted }}>
              {selectedRows.length === 0
                ? "Select Items to combine into one reviewed financial value."
                : `${selectedRows.length} selected · ${currency} ${selectedTotal.toLocaleString()}`}
            </Typography>
            <Button
              variant="contained"
              disabled={!canPromote || selectedRows.length === 0 || savingRow !== null}
              onClick={() => {
                setPromotionCurrency(currency);
                setPromotionOpen(true);
              }}
            >
              Create calculation value
            </Button>
          </Stack>
          {!canPromote ? (
            <Typography variant="caption" sx={{ color: dashboardTokens.textMuted }}>
              Reprocess a confirmed document before creating another calculation value.
            </Typography>
          ) : null}
          <TableContainer sx={{ overflowX: "auto" }}>
            <Table size="small" aria-label="Supplementary document items">
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox">
                    <Checkbox
                      inputProps={{ "aria-label": "Select all supplementary items" }}
                      disabled={!canPromote}
                      checked={matrix.rows.length > 0 && selectedIndexes.size === matrix.rows.length}
                      indeterminate={selectedIndexes.size > 0 && selectedIndexes.size < matrix.rows.length}
                      onChange={(event) => setSelectedIndexes(
                        event.target.checked
                          ? new Set(matrix.rows.map((row) => row.index))
                          : new Set(),
                      )}
                    />
                  </TableCell>
                  <TableCell sx={{ minWidth: 170 }}>Item</TableCell>
                  <TableCell sx={{ minWidth: 120 }}>Value ({currency})</TableCell>
                  {columns.map((column) => <TableCell key={column} sx={{ minWidth: 140 }}>{column}</TableCell>)}
                  {editable ? <TableCell align="right">Action</TableCell> : null}
                </TableRow>
              </TableHead>
              <TableBody>
                {matrix.rows.map((row) => {
                  const draft = drafts[row.index] ?? { value: String(row.value), attributes: {} };
                  return (
                    <TableRow key={row.index} hover>
                      <TableCell padding="checkbox">
                        <Checkbox
                          inputProps={{ "aria-label": `Select ${row.label}` }}
                          disabled={!canPromote}
                          checked={selectedIndexes.has(row.index)}
                          onChange={(event) => setSelectedIndexes((current) => {
                            const next = new Set(current);
                            if (event.target.checked) next.add(row.index);
                            else next.delete(row.index);
                            return next;
                          })}
                        />
                      </TableCell>
                      <TableCell component="th" scope="row">{row.label}</TableCell>
                      <TableCell>
                        <TextField
                          size="small"
                          inputMode="decimal"
                          value={draft.value}
                          disabled={!editable}
                          onChange={(event) => setDrafts((current) => ({
                            ...current,
                            [row.index]: { ...draft, value: event.target.value },
                          }))}
                        />
                      </TableCell>
                      {columns.map((column) => (
                        <TableCell key={column}>
                          <TextField
                            size="small"
                            value={draft.attributes[column] ?? ""}
                            disabled={!editable || column.toLowerCase() === "total"}
                            onChange={(event) => setDrafts((current) => ({
                              ...current,
                              [row.index]: {
                                ...draft,
                                attributes: { ...draft.attributes, [column]: event.target.value },
                              },
                            }))}
                          />
                        </TableCell>
                      ))}
                      {editable ? (
                        <TableCell align="right">
                          <Button
                            size="small"
                            startIcon={<SaveRoundedIcon />}
                            disabled={savingRow !== null}
                            onClick={() => void saveRow(row.index)}
                          >
                            Save
                          </Button>
                        </TableCell>
                      ) : null}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
          </Stack>
        )}

        {editable ? (
          <>
            <Divider />
            <Typography fontWeight={700}>Add supplementary row</Typography>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" }, gap: 1 }}>
              <TextField size="small" label="Label" value={newLabel} onChange={(event) => setNewLabel(event.target.value)} />
              <TextField size="small" label="Value (optional)" inputMode="decimal" value={newValue} onChange={(event) => setNewValue(event.target.value)} />
              <TextField size="small" label="Price (optional)" inputMode="decimal" value={newPrice} onChange={(event) => setNewPrice(event.target.value)} />
              <TextField size="small" label="Quantity (optional)" inputMode="decimal" value={newQuantity} onChange={(event) => setNewQuantity(event.target.value)} />
            </Box>
            <Button
              variant="contained"
              startIcon={<AddCircleOutlineRoundedIcon />}
              disabled={savingRow !== null}
              onClick={() => void addItem()}
              sx={{ alignSelf: "flex-start" }}
            >
              {savingRow === "new" ? "Adding…" : "Add item"}
            </Button>
            <Typography variant="caption" sx={{ color: dashboardTokens.textMuted }}>
              Leave value blank and provide numeric price and quantity to calculate the row total deterministically.
            </Typography>
          </>
        ) : null}
      </Stack>
      <Dialog open={promotionOpen} onClose={() => !promoting && setPromotionOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Create calculation value</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Alert severity="info">
              AI-BOSS will add the {selectedRows.length} stored Item values and create one pending review candidate. The total cannot be edited in this dialog.
            </Alert>
            <TextField
              label="Calculated total"
              value={`${promotionCurrency} ${selectedTotal.toLocaleString()}`}
              disabled
            />
            <FormControl fullWidth>
              <InputLabel id="promotion-metric-label">Financial metric</InputLabel>
              <Select
                labelId="promotion-metric-label"
                label="Financial metric"
                value={promotionMetric}
                onChange={(event) => setPromotionMetric(event.target.value)}
              >
                {FINANCIAL_METRIC_KEYS.filter((key) => key !== "runway_months").map((key) => (
                  <MenuItem key={key} value={key}>{FINANCIAL_METRIC_LABELS[key]}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel id="promotion-currency-label">Currency</InputLabel>
              <Select
                labelId="promotion-currency-label"
                label="Currency"
                value={promotionCurrency}
                onChange={(event) => setPromotionCurrency(event.target.value as "NZD" | "AUD")}
              >
                <MenuItem value="NZD">NZD</MenuItem>
                <MenuItem value="AUD">AUD</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="Reporting date"
              type="date"
              value={promotionDate}
              onChange={(event) => setPromotionDate(event.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button disabled={promoting} onClick={() => setPromotionOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={promoting || !promotionMetric || !promotionDate}
            onClick={() => void promoteItems()}
          >
            {promoting ? "Creating…" : "Create pending value"}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
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
    <Paper
      variant="outlined"
      sx={{
        ...panelStyles,
        minWidth: 0,
        position: { lg: "sticky" },
        top: { lg: 72 },
        maxHeight: { lg: "calc(100vh - 88px)" },
        overflowY: { lg: "auto" },
      }}
    >
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
        ) : preview?.type === "image" ? (
          <Box
            component="img"
            src={preview.url}
            alt={preview.alt}
            sx={{
              display: "block",
              width: "100%",
              maxHeight: { xs: 620, lg: "calc(100vh - 220px)" },
              objectFit: "contain",
              border: "1px solid",
              borderColor: dashboardTokens.border,
              borderRadius: 1.5,
              bgcolor: "white",
            }}
          />
        ) : preview?.type === "text" ? (
          <Box
            component="pre"
            sx={{
              m: 0,
              p: 2,
              maxHeight: { xs: 620, lg: "calc(100vh - 220px)" },
              overflow: "auto",
              whiteSpace: "pre-wrap",
              overflowWrap: "anywhere",
              border: "1px solid",
              borderColor: dashboardTokens.border,
              borderRadius: 1.5,
              bgcolor: dashboardTokens.surfaceAlt,
              color: dashboardTokens.textSoft,
              fontFamily: "monospace",
              fontSize: 13,
            }}
          >
            {preview.text || "No text could be extracted for preview."}
          </Box>
        ) : preview?.type === "table" ? (
          <>
            {preview.totalColumnCount > preview.displayedColumnCount ? (
              <Alert severity="info">Showing the first {preview.displayedColumnCount} of {preview.totalColumnCount} columns.</Alert>
            ) : null}
            {preview.warnings.length > 0 ? (
              <Alert severity="warning">{preview.warnings.length} worksheet warning{preview.warnings.length === 1 ? "" : "s"}. Review formula and formatting notes beside extracted candidates.</Alert>
            ) : null}
            <TableContainer
              sx={{
                maxHeight: { xs: 680, lg: "calc(100vh - 250px)" },
                border: "1px solid",
                borderColor: dashboardTokens.border,
                borderRadius: 1.5,
              }}
            >
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

        {excerpt ? <Box component="blockquote" sx={{ m: 0, px: 1.5, py: 1, borderLeft: "3px solid", borderColor: dashboardTokens.accent, bgcolor: "rgba(242,140,91,0.10)", color: dashboardTokens.textSoft, fontSize: 13 }}>{excerpt}</Box> : null}

        {warnings.length > 0 ? (
          <Alert severity="warning" icon={<WarningAmberRoundedIcon />}>
            {warnings.join(" ")}
          </Alert>
        ) : null}

        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" }, gap: 1 }}>
          <OriginalField label="Original metric" value={readOriginalValue(candidate, "metricKey")} />
          <FormControl size="small" fullWidth disabled={readOnly || edit.decision === "excluded"} error={invalidIncluded && !isFinancialMetricKey(edit.metricKey)}>
            <InputLabel id={`metric-${candidate.id}`}>Corrected metric</InputLabel>
            <Select
              labelId={`metric-${candidate.id}`}
              label="Corrected metric"
              value={edit.metricKey}
              onChange={(event) => {
                const metricKey = event.target.value;
                onChange({
                  metricKey,
                  ...(metricKey === "runway_months" ? { currency: "" } : {}),
                });
              }}
            >
              {FINANCIAL_METRIC_KEYS.map((key) => <MenuItem key={key} value={key}>{FINANCIAL_METRIC_LABELS[key]}</MenuItem>)}
            </Select>
          </FormControl>
          <OriginalField label="Original value" value={readOriginalValue(candidate, "value")} />
          <TextField size="small" label="Corrected value" inputMode="decimal" value={edit.value} disabled={readOnly || edit.decision === "excluded"} error={invalidIncluded && (edit.value.trim() === "" || !Number.isFinite(Number(edit.value)))} onChange={(event) => onChange({ value: event.target.value })} />
          <OriginalField label="Original currency" value={readOriginalValue(candidate, "currency")} />
          {edit.metricKey === "runway_months" ? (
            <TextField
              size="small"
              label="Corrected unit"
              value="Months"
              disabled
              helperText="Runway is unit-based and has no currency."
            />
          ) : (
            <FormControl size="small" fullWidth disabled={readOnly || edit.decision === "excluded"} error={invalidIncluded && edit.currency !== "NZD" && edit.currency !== "AUD"}>
              <InputLabel id={`currency-${candidate.id}`}>Corrected currency</InputLabel>
              <Select labelId={`currency-${candidate.id}`} label="Corrected currency" value={edit.currency} onChange={(event) => onChange({ currency: event.target.value })}>
                <MenuItem value="NZD">NZD</MenuItem><MenuItem value="AUD">AUD</MenuItem>
              </Select>
            </FormControl>
          )}
          <OriginalField label="Original reporting date" value={readOriginalValue(candidate, "asOfDate") !== "Not found" ? readOriginalValue(candidate, "asOfDate") : readOriginalValue(candidate, "periodEnd")} />
          <TextField size="small" type="date" label="Corrected reporting date" value={edit.reportingDate} disabled={readOnly || edit.decision === "excluded"} error={invalidIncluded && !isValidIsoDate(edit.reportingDate)} onChange={(event) => onChange({ reportingDate: event.target.value })} slotProps={{ inputLabel: { shrink: true } }} />
        </Box>
      </Stack>
    </Paper>
  );
}

function OriginalField({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ px: 1.5, py: 1, borderRadius: 1.5, border: "1px solid", borderColor: dashboardTokens.border, bgcolor: dashboardTokens.surfaceAlt }}>
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
