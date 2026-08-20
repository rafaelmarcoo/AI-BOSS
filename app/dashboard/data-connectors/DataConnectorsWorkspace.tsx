"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Box,
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
} from "@mui/material";
import { dashboardTokens } from "@/app/theme";
import { AccountingConnect } from "@/components/accounting-connect";
import type { ProviderStatus } from "@/lib/integrations/types";
import type { DocumentSummary } from "@/lib/documents/types";
import type { DocumentsApiResponse } from "@/app/dashboard/chat/types";

interface ProviderStatusApiResponse {
  success: boolean;
  data?: ProviderStatus[];
  error?: { message?: string };
}

interface FinancialMetricBySource {
  metricKey: string;
  sourceType: string;
  sourceLabel: string;
  value: number;
  currency: string | null;
}

interface FinancialMetricsBySourceApiResponse {
  success: boolean;
  data?: { metrics: FinancialMetricBySource[] };
  error?: { message?: string };
}

interface PivotColumn {
  key: string;
  label: string;
}

interface PivotRow {
  metricLabel: string;
  values: Record<string, number>;
}

function formatMetricKeyLabel(metricKey: string) {
  return metricKey
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function getExtractedMetrics(metadata: unknown): Record<string, number> | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  const extractedMetrics = (metadata as Record<string, unknown>).extractedMetrics;

  if (
    !extractedMetrics ||
    typeof extractedMetrics !== "object" ||
    Array.isArray(extractedMetrics)
  ) {
    return null;
  }

  return extractedMetrics as Record<string, number>;
}

const PROVIDER_LABELS: Record<string, string> = {
  xero: "Xero",
  quickbooks: "QuickBooks",
  freshbooks: "FreshBooks",
  myob: "MYOB",
};

const FILE_TYPE_LABELS: Record<string, string> = {
  pdf: "PDF",
  csv: "CSV",
  image: "Image",
};

interface ComparisonRow {
  key: string;
  kind: "connection" | "document";
  source: string;
  name: string;
  status: string;
  statusColor: string;
  date: string | null;
}

function formatDate(value: string | null) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("en-NZ", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function connectionStatusColor(status: ProviderStatus["status"]) {
  if (status === "connected") return "#86efac";
  if (status === "error") return "#fca5a5";
  return dashboardTokens.textMuted;
}

function documentStatusColor(status: DocumentSummary["status"]) {
  if (status === "ready") return "#86efac";
  if (status === "failed") return "#fca5a5";
  if (status === "processing") return "#93c5fd";
  return "#fde68a";
}

export function DataConnectorsWorkspace() {
  const [connections, setConnections] = useState<ProviderStatus[]>([]);
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [metricsBySource, setMetricsBySource] = useState<FinancialMetricBySource[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deselectedSources, setDeselectedSources] = useState<Set<string>>(
    new Set(),
  );
  const [deselectedPivotColumns, setDeselectedPivotColumns] = useState<
    Set<string>
  >(new Set());

  const togglePivotColumn = (key: string) => {
    setDeselectedPivotColumns((previous) => {
      const next = new Set(previous);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const toggleSource = (source: string) => {
    setDeselectedSources((previous) => {
      const next = new Set(previous);
      if (next.has(source)) {
        next.delete(source);
      } else {
        next.add(source);
      }
      return next;
    });
  };

  useEffect(() => {
    let isMounted = true;

    async function load() {
      try {
        const [statusResponse, documentsResponse, metricsResponse] =
          await Promise.all([
            fetch("/api/integrations/status", { credentials: "include" }),
            fetch("/api/documents", { credentials: "include" }),
            fetch("/api/financial-data/by-source", { credentials: "include" }),
          ]);

        const statusPayload =
          (await statusResponse.json()) as ProviderStatusApiResponse;
        const documentsPayload =
          (await documentsResponse.json()) as DocumentsApiResponse;
        const metricsPayload =
          (await metricsResponse.json()) as FinancialMetricsBySourceApiResponse;

        if (!statusResponse.ok || !statusPayload.success || !statusPayload.data) {
          throw new Error(
            statusPayload.error?.message ?? "Could not load connection statuses."
          );
        }

        if (
          !documentsResponse.ok ||
          !documentsPayload.success ||
          !documentsPayload.data
        ) {
          throw new Error(
            documentsPayload.error?.message ?? "Could not load documents."
          );
        }

        if (
          !metricsResponse.ok ||
          !metricsPayload.success ||
          !metricsPayload.data
        ) {
          throw new Error(
            metricsPayload.error?.message ?? "Could not load financial metrics."
          );
        }

        if (isMounted) {
          setConnections(statusPayload.data);
          setDocuments(documentsPayload.data.documents);
          setMetricsBySource(metricsPayload.data.metrics);
          setError(null);
        }
      } catch (loadError) {
        if (isMounted) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Could not load data connectors."
          );
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    void load();
    return () => {
      isMounted = false;
    };
  }, []);

  const rows = useMemo<ComparisonRow[]>(() => {
    const connectionRows: ComparisonRow[] = connections
      .filter((connection) => connection.status !== "available")
      .map((connection) => ({
        key: `connection-${connection.provider}`,
        kind: "connection",
        source: PROVIDER_LABELS[connection.provider] ?? connection.provider,
        name: connection.displayName ?? PROVIDER_LABELS[connection.provider] ?? connection.provider,
        status: connection.status,
        statusColor: connectionStatusColor(connection.status),
        date: connection.lastSyncedAt ?? connection.connectedAt,
      }));

    const documentRows: ComparisonRow[] = documents.map((document) => ({
      key: `document-${document.id}`,
      kind: "document",
      source: FILE_TYPE_LABELS[document.file_type] ?? document.file_type,
      name: document.file_name,
      status: document.status,
      statusColor: documentStatusColor(document.status),
      date: document.created_at,
    }));

    return [...connectionRows, ...documentRows].sort((left, right) => {
      const leftTime = left.date ? new Date(left.date).getTime() : 0;
      const rightTime = right.date ? new Date(right.date).getTime() : 0;
      return rightTime - leftTime;
    });
  }, [connections, documents]);

  const availableSources = useMemo(
    () => [...new Set(rows.map((row) => row.source))].sort(),
    [rows],
  );

  const visibleRows = useMemo(
    () => rows.filter((row) => !deselectedSources.has(row.source)),
    [rows, deselectedSources],
  );

  const pivot = useMemo(() => {
    const columns = new Map<string, string>();
    const pivotRows = new Map<string, Record<string, number>>();

    for (const metric of metricsBySource) {
      const columnKey = `provider-${metric.sourceType}`;
      columns.set(columnKey, PROVIDER_LABELS[metric.sourceType] ?? metric.sourceType);

      const metricLabel = formatMetricKeyLabel(metric.metricKey);
      const row = pivotRows.get(metricLabel) ?? {};
      row[columnKey] = metric.value;
      pivotRows.set(metricLabel, row);
    }

    for (const document of documents) {
      const extractedMetrics = getExtractedMetrics(document.metadata);
      if (!extractedMetrics) continue;

      const columnKey = `document-${document.id}`;
      columns.set(columnKey, document.file_name);

      for (const [label, value] of Object.entries(extractedMetrics)) {
        const row = pivotRows.get(label) ?? {};
        row[columnKey] = value;
        pivotRows.set(label, row);
      }
    }

    const sortedColumns: PivotColumn[] = [...columns.entries()]
      .map(([key, label]) => ({ key, label }))
      .sort((a, b) => a.label.localeCompare(b.label));

    const sortedRows: PivotRow[] = [...pivotRows.entries()]
      .map(([metricLabel, values]) => ({ metricLabel, values }))
      .sort((a, b) => a.metricLabel.localeCompare(b.metricLabel));

    return { columns: sortedColumns, rows: sortedRows };
  }, [metricsBySource, documents]);

  const visiblePivotColumns = useMemo(
    () => pivot.columns.filter((column) => !deselectedPivotColumns.has(column.key)),
    [pivot.columns, deselectedPivotColumns],
  );

  return (
    <Stack spacing={4}>
      <Box>
        <Typography
          variant="h6"
          fontWeight={700}
          sx={{ mb: 0.5, color: dashboardTokens.text }}
        >
          Data Connectors
        </Typography>
        <Typography variant="body2" sx={{ color: dashboardTokens.textMuted }}>
          Connect accounting sources and see everything you've linked in — accounting
          connections and uploaded documents — in one place.
        </Typography>
      </Box>

      <AccountingConnect />

      <Box>
        <Typography
          component="h2"
          sx={{ fontSize: 15, fontWeight: 600, mb: 1.5, color: dashboardTokens.text }}
        >
          Everything linked in
        </Typography>

        {!loading && !error && availableSources.length > 0 ? (
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
            {availableSources.map((source) => {
              const selected = !deselectedSources.has(source);

              return (
                <Chip
                  key={source}
                  label={source}
                  size="small"
                  onClick={() => toggleSource(source)}
                  variant={selected ? "filled" : "outlined"}
                  sx={{
                    color: selected ? dashboardTokens.text : dashboardTokens.textMuted,
                    bgcolor: selected ? dashboardTokens.surfaceAlt : "transparent",
                    borderColor: dashboardTokens.borderMuted,
                  }}
                />
              );
            })}
          </Stack>
        ) : null}

        {loading ? (
          <Typography sx={{ color: dashboardTokens.textMuted, fontSize: 14 }}>
            Loading...
          </Typography>
        ) : error ? (
          <Typography sx={{ color: "#fca5a5", fontSize: 14 }}>{error}</Typography>
        ) : rows.length === 0 ? (
          <Typography sx={{ color: dashboardTokens.textMuted, fontSize: 14 }}>
            Nothing connected or uploaded yet.
          </Typography>
        ) : visibleRows.length === 0 ? (
          <Typography sx={{ color: dashboardTokens.textMuted, fontSize: 14 }}>
            All sources are deselected.
          </Typography>
        ) : (
          <TableContainer
            component={Paper}
            elevation={0}
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
                    Type
                  </TableCell>
                  <TableCell sx={{ color: dashboardTokens.textMuted, fontWeight: 600 }}>
                    Source
                  </TableCell>
                  <TableCell sx={{ color: dashboardTokens.textMuted, fontWeight: 600 }}>
                    Name
                  </TableCell>
                  <TableCell sx={{ color: dashboardTokens.textMuted, fontWeight: 600 }}>
                    Status
                  </TableCell>
                  <TableCell sx={{ color: dashboardTokens.textMuted, fontWeight: 600 }}>
                    Last activity
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {visibleRows.map((row) => (
                  <TableRow key={row.key}>
                    <TableCell>
                      <Chip
                        size="small"
                        label={row.kind === "connection" ? "Accounting" : "Document"}
                        sx={{
                          color: dashboardTokens.textMuted,
                          borderColor: dashboardTokens.borderMuted,
                        }}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell sx={{ color: dashboardTokens.text }}>
                      {row.source}
                    </TableCell>
                    <TableCell sx={{ color: dashboardTokens.text }}>
                      {row.name}
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={row.status}
                        sx={{ color: row.statusColor, borderColor: row.statusColor }}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell sx={{ color: dashboardTokens.textMuted }}>
                      {formatDate(row.date)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>

      <Box>
        <Typography
          component="h2"
          sx={{ fontSize: 15, fontWeight: 600, mb: 1.5, color: dashboardTokens.text }}
        >
          Compare metrics across sources
        </Typography>

        {!loading && !error && pivot.columns.length > 0 ? (
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
            {pivot.columns.map((column) => {
              const selected = !deselectedPivotColumns.has(column.key);

              return (
                <Chip
                  key={column.key}
                  label={column.label}
                  size="small"
                  onClick={() => togglePivotColumn(column.key)}
                  variant={selected ? "filled" : "outlined"}
                  sx={{
                    color: selected ? dashboardTokens.text : dashboardTokens.textMuted,
                    bgcolor: selected ? dashboardTokens.surfaceAlt : "transparent",
                    borderColor: dashboardTokens.borderMuted,
                  }}
                />
              );
            })}
          </Stack>
        ) : null}

        {loading ? (
          <Typography sx={{ color: dashboardTokens.textMuted, fontSize: 14 }}>
            Loading...
          </Typography>
        ) : error ? (
          <Typography sx={{ color: "#fca5a5", fontSize: 14 }}>{error}</Typography>
        ) : pivot.rows.length === 0 ? (
          <Typography sx={{ color: dashboardTokens.textMuted, fontSize: 14 }}>
            No comparable metrics yet — connect an accounting source or upload an
            image with financial figures in it.
          </Typography>
        ) : visiblePivotColumns.length === 0 ? (
          <Typography sx={{ color: dashboardTokens.textMuted, fontSize: 14 }}>
            All sources are deselected.
          </Typography>
        ) : (
          <TableContainer
            component={Paper}
            elevation={0}
            sx={{
              borderRadius: 1,
              border: "1px solid",
              borderColor: dashboardTokens.border,
              bgcolor: dashboardTokens.surface,
              overflowX: "auto",
            }}
          >
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ color: dashboardTokens.textMuted, fontWeight: 600 }}>
                    Metric
                  </TableCell>
                  {visiblePivotColumns.map((column) => (
                    <TableCell
                      key={column.key}
                      align="right"
                      sx={{ color: dashboardTokens.textMuted, fontWeight: 600 }}
                    >
                      {column.label}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {pivot.rows.map((row) => (
                  <TableRow key={row.metricLabel}>
                    <TableCell sx={{ color: dashboardTokens.text }}>
                      {row.metricLabel}
                    </TableCell>
                    {visiblePivotColumns.map((column) => (
                      <TableCell
                        key={column.key}
                        align="right"
                        sx={{ color: dashboardTokens.text }}
                      >
                        {row.values[column.key] !== undefined
                          ? row.values[column.key]
                          : "—"}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>
    </Stack>
  );
}
