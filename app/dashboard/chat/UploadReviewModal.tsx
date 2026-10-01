"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  Dialog,
  IconButton,
  MenuItem,
  Select,
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
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import { dashboardTokens } from "@/app/theme";
import type { ItemAttributes } from "@/lib/financial-data/attributes";
import {
  buildItemMatrix,
  readExtractedItemsWithIndex,
} from "@/lib/financial-data/item-matrix";
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
  // Unique per row. The label can't be the key: the same label may appear more
  // than once (e.g. Revenue for two companies).
  key: string;
  label: string;
  value: number | null;
  rawValue?: string;
  observationId?: string;
  documentId?: string;
  // Set for rows that come from the document's extractedItems list.
  itemIndex?: number;
  attributes?: ItemAttributes;
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

function getDocumentCurrency(metadata: unknown): string {
  const record = asMetadataRecord(metadata);
  const currency = record?.currency;

  return typeof currency === "string" ? currency : "NZD";
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
  // Local overlay for document-backed (extractedMetrics) rows: covers both
  // corrections to an existing value and brand-new manually-added labels,
  // since `document.metadata` itself isn't refetched once a document is ready.
  const [metricOverrides, setMetricOverrides] = useState<Record<string, number>>({});
  // Same idea for rows that come from the extractedItems list, keyed by position.
  const [itemOverrides, setItemOverrides] = useState<Record<number, number>>({});
  // Fresh metadata returned by the server after an item edit. It replaces
  // document.metadata for display, because the document isn't refetched.
  const [liveMetadata, setLiveMetadata] = useState<unknown>(null);
  const [editingCell, setEditingCell] = useState<{ rowKey: string; column: string } | null>(null);
  const [editingCellValue, setEditingCellValue] = useState("");
  const [savingCell, setSavingCell] = useState(false);
  // Attribute columns the user just created that no row has a value for yet.
  const [extraColumns, setExtraColumns] = useState<string[]>([]);
  const [isAddingColumn, setIsAddingColumn] = useState(false);
  const [newColumnName, setNewColumnName] = useState("");
  const [isAddingRow, setIsAddingRow] = useState(false);
  const [newRowLabel, setNewRowLabel] = useState("");
  const [newRowValue, setNewRowValue] = useState("");
  const [addingRow, setAddingRow] = useState(false);
  const [currency, setCurrency] = useState("NZD");
  const [savingCurrency, setSavingCurrency] = useState(false);

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

  useEffect(() => {
    setMetricOverrides({});
    setItemOverrides({});
    setLiveMetadata(null);
    setEditingCell(null);
    setExtraColumns([]);
    setIsAddingColumn(false);
    setNewColumnName("");
    setIsAddingRow(false);
    setNewRowLabel("");
    setNewRowValue("");
    setCurrency(getDocumentCurrency(document?.metadata));
  }, [document?.id]);

  const saveCurrency = async (nextCurrency: string) => {
    if (!document || nextCurrency === currency) return;

    const previousCurrency = currency;
    setCurrency(nextCurrency);
    setSavingCurrency(true);
    setRowError(null);

    try {
      const response = await fetch(`/api/documents/${document.id}/currency`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currency: nextCurrency }),
      });
      const payload = await response.json();

      if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message ?? "Could not save the currency.");
      }
    } catch (saveError) {
      setCurrency(previousCurrency);
      setRowError(
        saveError instanceof Error ? saveError.message : "Could not save the currency.",
      );
    } finally {
      setSavingCurrency(false);
    }
  };

  const metadata = liveMetadata ?? document?.metadata;

  // Shows what the server saved. Returns false when the response carried no
  // document (the caller then falls back to its own local overlay).
  const applyServerDocument = (payload: unknown) => {
    const saved = (payload as { data?: { document?: { metadata?: unknown } } })?.data?.document
      ?.metadata;

    if (saved === undefined) return false;

    setLiveMetadata(saved);
    // The saved metadata already contains those value edits.
    setItemOverrides({});
    return true;
  };

  const rows = useMemo<ReviewRow[]>(() => {
    if (!document) return [];

    const observationRows: ReviewRow[] = observations.map((metric) => ({
      key: `observation:${metric.id}`,
      label: formatMetricKeyLabel(metric.metricKey),
      value: metric.value,
      observationId: metric.id,
    }));

    // Documents read by the model carry a full item list (repeated labels and
    // extra attributes included). Those rows are edited by position.
    const itemRows: ReviewRow[] = readExtractedItemsWithIndex(metadata).map(
      (item) => {
        const override = itemOverrides[item.index];
        const hasOverride = override !== undefined;

        return {
          key: `item:${item.index}`,
          label: item.label,
          value: hasOverride ? override : item.value,
          documentId: document.id,
          itemIndex: item.index,
          // A computed total that still matched the old value moves with it,
          // mirroring what the server does when it saves the edit.
          attributes:
            hasOverride && item.attributes.total === item.value
              ? { ...item.attributes, total: override }
              : item.attributes,
        };
      },
    );
    const itemLabels = new Set(itemRows.map((row) => row.label));

    const extractedMetrics = {
      ...getExtractedMetrics(metadata),
      ...metricOverrides,
    };
    // The label -> number map repeats the item list's first occurrences, so
    // only labels the list doesn't have (e.g. manually added rows) are shown.
    const metricRows: ReviewRow[] = Object.entries(extractedMetrics)
      .filter(([label]) => !itemLabels.has(label))
      .map(([label, value]) => ({
        key: `metric:${label}`,
        label,
        value,
        documentId: document.id,
      }));

    const issueRows: ReviewRow[] = getExtractedMetricIssues(metadata)
      .filter((issue) => !(issue.label in metricOverrides))
      .map((issue) => ({
        key: `issue:${issue.label}`,
        label: issue.label,
        value: null,
        rawValue: issue.rawValue,
        documentId: document.id,
      }));

    return [...observationRows, ...itemRows, ...metricRows, ...issueRows];
  }, [document, metadata, observations, metricOverrides, itemOverrides]);

  // One extra column per attribute name any row uses (entity, period, unit...),
  // plus any column the user just created that has no values yet.
  const attributeColumns = useMemo(() => {
    const used = buildItemMatrix(
      rows.map((row) => ({
        index: row.itemIndex ?? -1,
        label: row.label,
        value: row.value ?? 0,
        attributes: row.attributes ?? {},
      })),
    ).columns;
    const pending = extraColumns.filter(
      (column) => !used.some((name) => name.toLowerCase() === column.toLowerCase()),
    );

    return [...used, ...pending];
  }, [rows, extraColumns]);

  const startEditing = (row: ReviewRow) => {
    setRowError(null);
    setEditingRowKey(row.key);
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
      } else if (row.documentId && row.itemIndex !== undefined) {
        const response = await fetch(`/api/documents/${row.documentId}/items`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ index: row.itemIndex, value: parsed }),
        });
        const payload = await response.json();

        if (!response.ok || !payload.success) {
          throw new Error(payload.error?.message ?? "Could not save the value.");
        }

        if (!applyServerDocument(payload)) {
          setItemOverrides((previous) => ({ ...previous, [row.itemIndex as number]: parsed }));
        }
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

        setMetricOverrides((previous) => ({ ...previous, [row.label]: parsed }));
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

  const startEditingCell = (row: ReviewRow, column: string) => {
    setRowError(null);
    setEditingRowKey(null);
    setEditingCell({ rowKey: row.key, column });
    setEditingCellValue(row.attributes?.[column] !== undefined ? String(row.attributes[column]) : "");
  };

  const cancelEditingCell = () => {
    setEditingCell(null);
    setEditingCellValue("");
    setRowError(null);
  };

  const saveCell = async (row: ReviewRow, column: string) => {
    if (row.itemIndex === undefined || !row.documentId) return;

    setSavingCell(true);
    setRowError(null);

    try {
      const response = await fetch(`/api/documents/${row.documentId}/items`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        // Blank text removes the attribute on the server.
        body: JSON.stringify({
          index: row.itemIndex,
          attributes: { [column]: editingCellValue.trim() },
        }),
      });
      const payload = await response.json();

      if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message ?? "Could not save the attribute.");
      }

      applyServerDocument(payload);
      cancelEditingCell();
    } catch (saveError) {
      setRowError(
        saveError instanceof Error ? saveError.message : "Could not save the attribute.",
      );
    } finally {
      setSavingCell(false);
    }
  };

  const addColumn = () => {
    const name = newColumnName.trim();

    if (!name) {
      setRowError("Enter a name for the new column.");
      return;
    }

    if (attributeColumns.some((column) => column.toLowerCase() === name.toLowerCase())) {
      setRowError("A column with that name already exists.");
      return;
    }

    setExtraColumns((previous) => [...previous, name]);
    setIsAddingColumn(false);
    setNewColumnName("");
    setRowError(null);
  };

  const startAddingRow = () => {
    setRowError(null);
    setNewRowLabel("");
    setNewRowValue("");
    setIsAddingRow(true);
  };

  const cancelAddingRow = () => {
    setIsAddingRow(false);
    setNewRowLabel("");
    setNewRowValue("");
    setRowError(null);
  };

  const saveNewRow = async () => {
    if (!document) return;

    const label = newRowLabel.trim();
    const parsed = Number(newRowValue.trim());

    if (!label) {
      setRowError("Enter a name for the new metric.");
      return;
    }

    if (!newRowValue.trim() || !Number.isFinite(parsed)) {
      setRowError("Enter a valid number.");
      return;
    }

    setAddingRow(true);
    setRowError(null);

    try {
      const response = await fetch(`/api/documents/${document.id}/items`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label, value: parsed }),
      });
      const payload = await response.json();

      if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message ?? "Could not save the new metric.");
      }

      if (!applyServerDocument(payload)) {
        setMetricOverrides((previous) => ({ ...previous, [label]: parsed }));
      }
      cancelAddingRow();
    } catch (saveError) {
      setRowError(
        saveError instanceof Error ? saveError.message : "Could not save the new metric.",
      );
    } finally {
      setAddingRow(false);
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
            <Stack
              direction="row"
              spacing={2}
              alignItems="center"
              justifyContent="space-between"
              flexWrap="wrap"
            >
              <Typography variant="h6" sx={{ color: dashboardTokens.text }}>
                {document.file_name}
              </Typography>

              <Stack direction="row" spacing={1} alignItems="center">
                <Typography
                  variant="caption"
                  sx={{ color: dashboardTokens.textMuted, textTransform: "uppercase" }}
                >
                  Currency
                </Typography>
                <Select
                  size="small"
                  value={currency}
                  disabled={savingCurrency}
                  onChange={(event) => void saveCurrency(event.target.value)}
                  sx={{
                    minWidth: 90,
                    color: dashboardTokens.text,
                    bgcolor: "rgba(255,255,255,0.04)",
                    ".MuiOutlinedInput-notchedOutline": {
                      borderColor: dashboardTokens.borderMuted,
                    },
                    ".MuiSvgIcon-root": { color: dashboardTokens.textMuted },
                  }}
                >
                  <MenuItem value="NZD">NZD</MenuItem>
                  <MenuItem value="USD">USD</MenuItem>
                </Select>
                {savingCurrency ? <CircularProgress size={16} /> : null}
              </Stack>
            </Stack>

            {rowsLoading ? (
              <Typography sx={{ color: dashboardTokens.textMuted, fontSize: 14 }}>
                Loading extracted data...
              </Typography>
            ) : rows.length === 0 && !isAddingRow ? (
              <Stack spacing={1.5} alignItems="flex-start">
                <Typography sx={{ color: dashboardTokens.textMuted, fontSize: 14 }}>
                  No financial data was recognized in this file.
                </Typography>
                <Chip
                  size="small"
                  icon={<AddRoundedIcon fontSize="small" />}
                  label="Add metric"
                  onClick={startAddingRow}
                  sx={{ cursor: "pointer" }}
                />
              </Stack>
            ) : (
              <TableContainer
                sx={{
                  borderRadius: 1,
                  border: "1px solid",
                  borderColor: dashboardTokens.border,
                  bgcolor: dashboardTokens.surface,
                  // Bounded height so the header can stay in view on long documents.
                  maxHeight: "calc(80vh - 210px)",
                }}
              >
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell
                        sx={{
                          color: dashboardTokens.textMuted,
                          fontWeight: 600,
                          bgcolor: dashboardTokens.surface,
                        }}
                      >
                        Metric
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{
                          color: dashboardTokens.textMuted,
                          fontWeight: 600,
                          bgcolor: dashboardTokens.surface,
                        }}
                      >
                        Value
                      </TableCell>
                      {attributeColumns.map((column) => (
                        <TableCell
                          key={column}
                          sx={{
                            color: dashboardTokens.textMuted,
                            fontWeight: 600,
                            bgcolor: dashboardTokens.surface,
                            textTransform: "capitalize",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {column}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rows.map((row) => {
                      const isFlagged = row.value === null;
                      const isEditing = editingRowKey === row.key;

                      return (
                        <TableRow key={row.key}>
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
                                    sx={{
                                      cursor: "pointer",
                                      bgcolor: dashboardTokens.accent,
                                      color: "common.white",
                                      fontWeight: 700,
                                      "&:hover": { bgcolor: dashboardTokens.accentHover },
                                    }}
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
                          {attributeColumns.map((column) => {
                            const isEditable = row.itemIndex !== undefined;
                            const isEditingThisCell =
                              editingCell?.rowKey === row.key && editingCell.column === column;

                            if (isEditingThisCell) {
                              return (
                                <TableCell key={column}>
                                  <Stack direction="row" spacing={0.5} alignItems="center">
                                    <TextField
                                      size="small"
                                      autoFocus
                                      value={editingCellValue}
                                      onChange={(event) => setEditingCellValue(event.target.value)}
                                      onKeyDown={(event) => {
                                        if (event.key === "Enter") {
                                          void saveCell(row, column);
                                        } else if (event.key === "Escape") {
                                          cancelEditingCell();
                                        }
                                      }}
                                      disabled={savingCell}
                                      sx={{
                                        minWidth: 110,
                                        "& .MuiOutlinedInput-root": {
                                          color: dashboardTokens.text,
                                          bgcolor: "rgba(255,255,255,0.04)",
                                        },
                                      }}
                                    />
                                    {savingCell ? (
                                      <CircularProgress size={18} />
                                    ) : (
                                      <Chip
                                        size="small"
                                        label="Save"
                                        onClick={() => void saveCell(row, column)}
                                        sx={{
                                          cursor: "pointer",
                                          bgcolor: dashboardTokens.accent,
                                          color: "common.white",
                                          fontWeight: 700,
                                          "&:hover": { bgcolor: dashboardTokens.accentHover },
                                        }}
                                      />
                                    )}
                                  </Stack>
                                </TableCell>
                              );
                            }

                            return (
                              <TableCell
                                key={column}
                                onClick={isEditable ? () => startEditingCell(row, column) : undefined}
                                title={isEditable ? "Click to edit" : undefined}
                                sx={{
                                  color: dashboardTokens.textMuted,
                                  whiteSpace: "nowrap",
                                  ...(isEditable
                                    ? {
                                        cursor: "pointer",
                                        "&:hover": { bgcolor: dashboardTokens.surfaceAlt },
                                      }
                                    : {}),
                                }}
                              >
                                {row.attributes?.[column] ?? "–"}
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      );
                    })}
                    {isAddingRow ? (
                      <TableRow>
                        <TableCell>
                          <TextField
                            size="small"
                            autoFocus
                            placeholder="Metric name"
                            value={newRowLabel}
                            onChange={(event) => setNewRowLabel(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === "Escape") cancelAddingRow();
                            }}
                            disabled={addingRow}
                            error={Boolean(rowError)}
                            sx={{
                              "& .MuiOutlinedInput-root": {
                                color: dashboardTokens.text,
                                bgcolor: "rgba(255,255,255,0.04)",
                              },
                            }}
                          />
                        </TableCell>
                        <TableCell align="right">
                          <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                            <TextField
                              size="small"
                              placeholder="Value"
                              value={newRowValue}
                              onChange={(event) => setNewRowValue(event.target.value)}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  void saveNewRow();
                                } else if (event.key === "Escape") {
                                  cancelAddingRow();
                                }
                              }}
                              disabled={addingRow}
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
                            {addingRow ? (
                              <CircularProgress size={18} />
                            ) : (
                              <Chip
                                size="small"
                                label="Save"
                                onClick={() => void saveNewRow()}
                                sx={{
                                  cursor: "pointer",
                                  bgcolor: dashboardTokens.accent,
                                  color: "common.white",
                                  fontWeight: 700,
                                  "&:hover": { bgcolor: dashboardTokens.accentHover },
                                }}
                              />
                            )}
                          </Stack>
                        </TableCell>
                        {attributeColumns.length > 0 ? (
                          <TableCell colSpan={attributeColumns.length} />
                        ) : null}
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </TableContainer>
            )}

            {!rowsLoading && rows.length > 0 && !isAddingRow ? (
              <Stack direction="row" spacing={1} alignItems="center">
                <Chip
                  size="small"
                  icon={<AddRoundedIcon fontSize="small" />}
                  label="Add metric"
                  onClick={startAddingRow}
                  sx={{ cursor: "pointer" }}
                />
                {isAddingColumn ? (
                  <>
                    <TextField
                      size="small"
                      autoFocus
                      placeholder="Column name, e.g. Department"
                      value={newColumnName}
                      onChange={(event) => setNewColumnName(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          addColumn();
                        } else if (event.key === "Escape") {
                          setIsAddingColumn(false);
                          setNewColumnName("");
                        }
                      }}
                      sx={{
                        minWidth: 220,
                        "& .MuiOutlinedInput-root": {
                          color: dashboardTokens.text,
                          bgcolor: "rgba(255,255,255,0.04)",
                        },
                      }}
                    />
                    <Chip
                      size="small"
                      label="Add"
                      onClick={addColumn}
                      sx={{
                        cursor: "pointer",
                        bgcolor: dashboardTokens.accent,
                        color: "common.white",
                        fontWeight: 700,
                        "&:hover": { bgcolor: dashboardTokens.accentHover },
                      }}
                    />
                  </>
                ) : (
                  <Chip
                    size="small"
                    icon={<AddRoundedIcon fontSize="small" />}
                    label="Add column"
                    onClick={() => {
                      setRowError(null);
                      setIsAddingColumn(true);
                    }}
                    sx={{ cursor: "pointer" }}
                  />
                )}
              </Stack>
            ) : null}
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
