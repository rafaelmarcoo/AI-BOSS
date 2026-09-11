"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  Dialog,
  IconButton,
  Snackbar,
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
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import { dashboardTokens } from "@/app/theme";
import type { DocumentSummaryView } from "./types";

interface UploadReviewModalProps {
  uploading: boolean;
  document: DocumentSummaryView | null;
  onClose: () => void;
}

interface FinancialMetricBySource {
  id: string;
  metricKey: string;
  sourceLabel: string;
  value: number;
  documentId: string | null;
}

interface ReviewRow {
  label: string;
  value: number | null;
  rawValue?: string;
  observationId?: string;
  documentId?: string;
}

function formatMetricKeyLabel(metricKey: string) {
  return metricKey
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function asMetadataRecord(metadata: unknown): Record<string, unknown> | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  return metadata as Record<string, unknown>;
}

function getExtractedMetrics(metadata: unknown): Record<string, number> {
  const record = asMetadataRecord(metadata);
  const extractedMetrics = record?.extractedMetrics;

  return extractedMetrics &&
    typeof extractedMetrics === "object" &&
    !Array.isArray(extractedMetrics)
    ? (extractedMetrics as Record<string, number>)
    : {};
}

interface ExtractedMetricIssue {
  label: string;
  rawValue: string;
}

function getExtractedMetricIssues(metadata: unknown): ExtractedMetricIssue[] {
  const record = asMetadataRecord(metadata);
  const issues = record?.extractedMetricIssues;

  return Array.isArray(issues) ? (issues as ExtractedMetricIssue[]) : [];
}

export function UploadReviewModal({
  uploading,
  document,
  onClose,
}: UploadReviewModalProps) {
  const [observations, setObservations] = useState<FinancialMetricBySource[]>([]);
  const [rowsLoading, setRowsLoading] = useState(false);
  const [editingRowKey, setEditingRowKey] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [savingRow, setSavingRow] = useState(false);
  const [rowError, setRowError] = useState<string | null>(null);

  const isOpen = uploading || Boolean(document);
  const isProcessing =
    !uploading &&
    (document?.status === "uploaded" || document?.status === "processing");
  const isReady = !uploading && document?.status === "ready";

  useEffect(() => {
    if (!isReady || !document) {
      return;
    }

    let isMounted = true;
    const documentId = document.id;

    async function loadObservations() {
      setRowsLoading(true);

      try {
        const response = await fetch("/api/financial-data/by-source", {
          credentials: "include",
        });
        const payload = await response.json();

        if (isMounted && response.ok && payload.success) {
          setObservations(
            (payload.data.metrics as FinancialMetricBySource[]).filter(
              (metric) => metric.documentId === documentId,
            ),
          );
        }
      } finally {
        if (isMounted) setRowsLoading(false);
      }
    }

    void loadObservations();
    return () => {
      isMounted = false;
    };
  }, [isReady, document]);

  const rows = useMemo<ReviewRow[]>(() => {
    if (!document) return [];

    const observationRows: ReviewRow[] = observations.map((metric) => ({
      label: formatMetricKeyLabel(metric.metricKey),
      value: metric.value,
      observationId: metric.id,
    }));

    const extractedMetrics = getExtractedMetrics(document.metadata);
    const metricRows: ReviewRow[] = Object.entries(extractedMetrics).map(
      ([label, value]) => ({ label, value, documentId: document.id }),
    );

    const issueRows: ReviewRow[] = getExtractedMetricIssues(
      document.metadata,
    ).map((issue) => ({
      label: issue.label,
      value: null,
      rawValue: issue.rawValue,
      documentId: document.id,
    }));

    return [...observationRows, ...metricRows, ...issueRows];
  }, [document, observations]);

  const startEditing = (row: ReviewRow) => {
    setRowError(null);
    setEditingRowKey(row.label);
    setEditingValue(
      row.value !== null && row.value !== undefined
        ? String(row.value)
        : row.rawValue ?? "",
    );
  };

  const cancelEditing = () => {
    setEditingRowKey(null);
    setEditingValue("");
    setRowError(null);
  };

  const saveEditing = async (row: ReviewRow) => {
    const parsed = Number(editingValue.trim());

    if (!editingValue.trim() || !Number.isFinite(parsed)) {
      setRowError("Enter a valid number.");
      return;
    }

    setSavingRow(true);
    setRowError(null);

    try {
      if (row.observationId) {
        const response = await fetch(
          `/api/financial-data/observations/${row.observationId}`,
          {
            method: "PATCH",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ value: parsed }),
          },
        );
        const payload = await response.json();

        if (!response.ok || !payload.success) {
          throw new Error(payload.error?.message ?? "Could not save the value.");
        }

        setObservations((previous) =>
          previous.map((metric) =>
            metric.id === row.observationId ? { ...metric, value: parsed } : metric,
          ),
        );
      } else if (row.documentId) {
        const response = await fetch(
          `/api/documents/${row.documentId}/metrics`,
          {
            method: "PATCH",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ label: row.label, value: parsed }),
          },
        );
        const payload = await response.json();

        if (!response.ok || !payload.success) {
          throw new Error(payload.error?.message ?? "Could not save the value.");
        }
      }

      cancelEditing();
    } catch (saveError) {
      setRowError(
        saveError instanceof Error ? saveError.message : "Could not save the value.",
      );
    } finally {
      setSavingRow(false);
    }
  };

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      fullWidth
      maxWidth="lg"
      PaperProps={{
        sx: {
          height: "80vh",
          maxHeight: "80vh",
          bgcolor: "#111218",
          color: "common.white",
          border: "1px solid",
          borderColor: dashboardTokens.border,
        },
      }}
    >
      <Box sx={{ display: "flex", justifyContent: "flex-end", p: 1 }}>
        <IconButton
          aria-label="Close"
          onClick={onClose}
          size="small"
          sx={{ color: dashboardTokens.textMuted }}
        >
          <CloseRoundedIcon fontSize="small" />
        </IconButton>
      </Box>

      <Box
        sx={{
          flex: 1,
          display: "flex",
          alignItems: isReady ? "stretch" : "center",
          justifyContent: isReady ? "flex-start" : "center",
          px: 4,
          pb: 4,
          overflow: "auto",
        }}
      >
        {uploading || isProcessing ? (
          <Stack spacing={2} alignItems="center">
            <CircularProgress />
            <Typography variant="h6" sx={{ color: dashboardTokens.text }}>
              {uploading ? "Uploading..." : "Processing..."}
            </Typography>
          </Stack>
        ) : document?.status === "failed" ? (
          <Stack spacing={1.5} alignItems="center" sx={{ maxWidth: 480, textAlign: "center" }}>
            <Typography variant="h6" sx={{ color: "#fca5a5" }}>
              Something went wrong
            </Typography>
            <Typography variant="body2" sx={{ color: dashboardTokens.textMuted }}>
              {document.error_message ?? `${document.file_name} could not be processed.`}
            </Typography>
          </Stack>
        ) : isReady && document ? (
          <Stack spacing={2} sx={{ width: "100%" }}>
            <Typography variant="h6" sx={{ color: dashboardTokens.text }}>
              {document.file_name}
            </Typography>

            {rowsLoading ? (
              <Typography sx={{ color: dashboardTokens.textMuted, fontSize: 14 }}>
                Loading extracted data...
              </Typography>
            ) : rows.length === 0 ? (
              <Typography sx={{ color: dashboardTokens.textMuted, fontSize: 14 }}>
                No financial data was recognized in this file.
              </Typography>
            ) : (
              <TableContainer
                sx={{
                  borderRadius: 1,
                  border: "1px solid",
                  borderColor: dashboardTokens.border,
                  bgcolor: dashboardTokens.surface,
                }}
              >
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ color: dashboardTokens.textMuted, fontWeight: 600 }}>
                        Metric
                      </TableCell>
                      <TableCell align="right" sx={{ color: dashboardTokens.textMuted, fontWeight: 600 }}>
                        Value
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rows.map((row) => {
                      const isFlagged = row.value === null;
                      const isEditing = editingRowKey === row.label;

                      return (
                        <TableRow key={row.label}>
                          <TableCell sx={{ color: dashboardTokens.text }}>
                            {row.label}
                          </TableCell>
                          {isEditing ? (
                            <TableCell align="right">
                              <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                                <TextField
                                  size="small"
                                  autoFocus
                                  value={editingValue}
                                  onChange={(event) => setEditingValue(event.target.value)}
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter") {
                                      void saveEditing(row);
                                    } else if (event.key === "Escape") {
                                      cancelEditing();
                                    }
                                  }}
                                  disabled={savingRow}
                                  error={Boolean(rowError)}
                                  sx={{
                                    maxWidth: 140,
                                    "& .MuiOutlinedInput-root": {
                                      color: dashboardTokens.text,
                                      bgcolor: "rgba(255,255,255,0.04)",
                                    },
                                  }}
                                  inputProps={{ style: { textAlign: "right" } }}
                                />
                                {savingRow ? (
                                  <CircularProgress size={18} />
                                ) : (
                                  <Chip
                                    size="small"
                                    label="Save"
                                    onClick={() => void saveEditing(row)}
                                    sx={{ cursor: "pointer" }}
                                  />
                                )}
                              </Stack>
                            </TableCell>
                          ) : (
                            <TableCell
                              align="right"
                              onClick={() => startEditing(row)}
                              sx={{
                                color: isFlagged ? "#fca5a5" : dashboardTokens.text,
                                cursor: "pointer",
                                "&:hover": { bgcolor: dashboardTokens.surfaceAlt },
                              }}
                              title={
                                isFlagged
                                  ? `Couldn't read "${row.rawValue}" as a number — click to correct`
                                  : "Click to edit"
                              }
                            >
                              {isFlagged ? `"${row.rawValue}"` : row.value}
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Stack>
        ) : null}
      </Box>

      <Snackbar
        open={Boolean(rowError)}
        autoHideDuration={5000}
        onClose={() => setRowError(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity="error" variant="filled" onClose={() => setRowError(null)}>
          {rowError}
        </Alert>
      </Snackbar>
    </Dialog>
  );
}
