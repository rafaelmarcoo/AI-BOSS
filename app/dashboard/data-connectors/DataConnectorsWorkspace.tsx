"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Alert,
  Button,
  Chip,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
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
import CloudUploadOutlinedIcon from "@mui/icons-material/CloudUploadOutlined";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import { dashboardCanvasTokens as tokens } from "@/app/theme";
import { AccountingConnect } from "@/components/accounting-connect";
import { FINANCIAL_METRIC_LABELS } from "@/lib/financial-data";
import { getDocumentStatusPresentation } from "@/lib/documents/presentation";
import type { DocumentSummary } from "@/lib/documents/types";
import type { ProviderStatus } from "@/lib/integrations/types";
import type { FinancialMetricBySource } from "@/lib/financial-data/persistence";

interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  error?: { message?: string };
}

const PROVIDER_LABELS: Record<string, string> = {
  xero: "Xero",
  quickbooks: "QuickBooks",
  freshbooks: "FreshBooks",
  myob: "MYOB",
  zoho_books: "Zoho Books",
  freeagent: "FreeAgent",
};

type FileFilter = "all" | DocumentSummary["file_type"];
type ReviewFilter = "all" | DocumentSummary["financial_review_status"];

function formatDate(value: string | null) {
  return value
    ? new Intl.DateTimeFormat("en-NZ", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
    : "—";
}

function formatMetricValue(metric: FinancialMetricBySource) {
  if (metric.metricKey === "runway_months") {
    return `${new Intl.NumberFormat("en-NZ", { maximumFractionDigits: 1 }).format(metric.value)} months`;
  }
  return `${metric.currency ?? "—"} ${new Intl.NumberFormat("en-NZ", { maximumFractionDigits: 0 }).format(metric.value)}`;
}

export function DataConnectorsWorkspace() {
  const [connections, setConnections] = useState<ProviderStatus[]>([]);
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [metrics, setMetrics] = useState<FinancialMetricBySource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [comparisonNotice, setComparisonNotice] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [fileFilter, setFileFilter] = useState<FileFilter>("all");
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>("all");
  const [hiddenSources, setHiddenSources] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [statusResponse, documentsResponse, metricsResponse] = await Promise.all([
        fetch("/api/integrations/status"),
        fetch("/api/documents"),
        fetch("/api/financial-data/by-source"),
      ]);
      const statusPayload = (await statusResponse.json()) as ApiEnvelope<ProviderStatus[]>;
      const documentsPayload = (await documentsResponse.json()) as ApiEnvelope<{ documents: DocumentSummary[] }>;
      const metricsPayload = (await metricsResponse.json()) as ApiEnvelope<{ metrics: FinancialMetricBySource[] }>;

      if (!statusResponse.ok || !statusPayload.success || !statusPayload.data) {
        throw new Error(statusPayload.error?.message ?? "Could not load accounting connections.");
      }
      if (!documentsResponse.ok || !documentsPayload.success || !documentsPayload.data) {
        throw new Error(documentsPayload.error?.message ?? "Could not load documents.");
      }

      setConnections(statusPayload.data);
      setDocuments(documentsPayload.data.documents);
      if (metricsResponse.ok && metricsPayload.success && metricsPayload.data) {
        setMetrics(metricsPayload.data.metrics);
        setComparisonNotice(null);
      } else if (metricsResponse.status === 403) {
        setMetrics([]);
        setComparisonNotice("Only a company administrator can compare company-approved financial values.");
      } else {
        throw new Error(metricsPayload.error?.message ?? "Could not load confirmed source values.");
      }
      setError(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not load data sources.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const visibleDocuments = useMemo(() => {
    const query = search.trim().toLowerCase();
    return documents.filter((document) =>
      (fileFilter === "all" || document.file_type === fileFilter) &&
      (reviewFilter === "all" || document.financial_review_status === reviewFilter) &&
      (!query || document.file_name.toLowerCase().includes(query)),
    );
  }, [documents, fileFilter, reviewFilter, search]);

  const comparison = useMemo(() => {
    const columnMap = new Map<string, { key: string; label: string; currency: string | null }>();
    const rowMap = new Map<string, Map<string, FinancialMetricBySource>>();

    for (const metric of metrics) {
      const columnKey = `${metric.sourceKey}|${metric.currency ?? "unit"}`;
      columnMap.set(columnKey, {
        key: columnKey,
        label: `${metric.sourceLabel}${metric.currency ? ` · ${metric.currency}` : ""}`,
        currency: metric.currency,
      });
      const row = rowMap.get(metric.metricKey) ?? new Map();
      row.set(columnKey, metric);
      rowMap.set(metric.metricKey, row);
    }

    return {
      columns: [...columnMap.values()].sort((left, right) => left.label.localeCompare(right.label)),
      rows: [...rowMap.entries()].sort(([left], [right]) =>
        (FINANCIAL_METRIC_LABELS[left as keyof typeof FINANCIAL_METRIC_LABELS] ?? left)
          .localeCompare(FINANCIAL_METRIC_LABELS[right as keyof typeof FINANCIAL_METRIC_LABELS] ?? right),
      ),
    };
  }, [metrics]);

  const visibleComparisonColumns = comparison.columns.filter((column) => !hiddenSources.has(column.key));

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={1.5}>
        <Stack spacing={0.5}>
          <Typography component="h1" variant="h5" fontWeight={750}>Data Connectors</Typography>
          <Typography variant="body2" sx={{ color: tokens.textMuted }}>
            Manage accounting connections, uploaded evidence, and read-only comparisons of company-approved values.
          </Typography>
        </Stack>
        <Button component={Link} href="/landing" variant="contained" startIcon={<CloudUploadOutlinedIcon />} sx={{ alignSelf: { sm: "center" } }}>
          Upload a document
        </Button>
      </Stack>

      <AccountingConnect onChanged={() => void load()} />

      {error ? <Alert severity="error" onClose={() => setError(null)}>{error}</Alert> : null}
      {loading ? <Stack alignItems="center" sx={{ py: 5 }}><CircularProgress /></Stack> : null}

      {!loading ? (
        <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2 }, borderColor: tokens.border, borderRadius: 2.5 }}>
          <Stack spacing={2}>
            <Stack>
              <Typography component="h2" variant="h6" fontWeight={700}>Everything linked in</Typography>
              <Typography variant="body2" sx={{ color: tokens.textMuted }}>
                Provider credentials remain user-private; document visibility follows the existing owner and company-administrator rules.
              </Typography>
            </Stack>
            <TableContainer sx={{ overflowX: "auto" }}>
              <Table size="small" aria-label="Linked accounting providers and documents">
                <TableHead><TableRow><TableCell>Type</TableCell><TableCell>Source</TableCell><TableCell>Name</TableCell><TableCell>Status</TableCell><TableCell>Last activity</TableCell></TableRow></TableHead>
                <TableBody>
                  {connections.map((connection) => (
                    <TableRow key={connection.provider} hover>
                      <TableCell><Chip size="small" label="Accounting" variant="outlined" /></TableCell>
                      <TableCell>{PROVIDER_LABELS[connection.provider] ?? connection.provider}</TableCell>
                      <TableCell>{connection.displayName ?? "—"}</TableCell>
                      <TableCell><Chip size="small" label={connection.status === "unavailable" ? "Configuration required" : connection.status} color={connection.status === "connected" ? "success" : "default"} variant="outlined" /></TableCell>
                      <TableCell>{formatDate(connection.lastSyncedAt ?? connection.connectedAt)}</TableCell>
                    </TableRow>
                  ))}
                  {documents.map((document) => {
                    const status = getDocumentStatusPresentation(document);
                    return (
                      <TableRow key={document.id} hover>
                        <TableCell><Chip size="small" label="Document" variant="outlined" /></TableCell>
                        <TableCell>{document.file_type.toUpperCase()}</TableCell>
                        <TableCell><Link href={`/dashboard/documents/${encodeURIComponent(document.id)}`}>{document.file_name}</Link></TableCell>
                        <TableCell><Chip size="small" label={status.label} variant="outlined" sx={{ color: status.color, borderColor: status.borderColor }} /></TableCell>
                        <TableCell>{formatDate(document.updated_at)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Stack>
        </Paper>
      ) : null}

      {!loading ? (
        <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2 }, borderColor: tokens.border, borderRadius: 2.5 }}>
          <Stack spacing={2}>
            <Stack>
              <Typography component="h2" variant="h6" fontWeight={700}>Uploaded documents</Typography>
              <Typography variant="body2" sx={{ color: tokens.textMuted }}>Filter evidence by name, format, and review state.</Typography>
            </Stack>
            <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
              <TextField size="small" label="Search documents" value={search} onChange={(event) => setSearch(event.target.value)} slotProps={{ input: { startAdornment: <SearchRoundedIcon fontSize="small" sx={{ mr: 1, color: tokens.textMuted }} /> } }} sx={{ flex: 1 }} />
              <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel id="connector-file-filter">File type</InputLabel>
                <Select labelId="connector-file-filter" label="File type" value={fileFilter} onChange={(event) => setFileFilter(event.target.value as FileFilter)}>
                  <MenuItem value="all">All formats</MenuItem>
                  {(["pdf", "csv", "xlsx", "image", "text", "docx"] as const).map((type) => <MenuItem key={type} value={type}>{type.toUpperCase()}</MenuItem>)}
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 175 }}>
                <InputLabel id="connector-review-filter">Review status</InputLabel>
                <Select labelId="connector-review-filter" label="Review status" value={reviewFilter} onChange={(event) => setReviewFilter(event.target.value as ReviewFilter)}>
                  <MenuItem value="all">All review states</MenuItem>
                  <MenuItem value="pending">Pending review</MenuItem>
                  <MenuItem value="confirmed">Confirmed</MenuItem>
                  <MenuItem value="not_required">No fixed values</MenuItem>
                </Select>
              </FormControl>
            </Stack>
            {visibleDocuments.length === 0 ? (
              <Typography variant="body2" sx={{ color: tokens.textMuted }}>No documents match these filters.</Typography>
            ) : (
              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                {visibleDocuments.map((document) => <Chip key={document.id} component={Link} clickable href={`/dashboard/documents/${encodeURIComponent(document.id)}`} label={`${document.file_name} · ${document.file_type.toUpperCase()}`} />)}
              </Stack>
            )}
          </Stack>
        </Paper>
      ) : null}

      {!loading ? (
        <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2 }, borderColor: tokens.border, borderRadius: 2.5 }}>
          <Stack spacing={2}>
            <Stack>
              <Typography component="h2" variant="h6" fontWeight={700}>Compare confirmed values across sources</Typography>
              <Typography variant="body2" sx={{ color: tokens.textMuted }}>
                Read-only comparison from company-authorized financial observations. Unreviewed candidates and supplementary Items are excluded.
              </Typography>
            </Stack>
            {comparisonNotice ? <Alert severity="info">{comparisonNotice}</Alert> : null}
            {comparison.columns.length > 0 ? (
              <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                {comparison.columns.map((column) => (
                  <Chip
                    key={column.key}
                    label={column.label}
                    clickable
                    color={hiddenSources.has(column.key) ? "default" : "primary"}
                    variant={hiddenSources.has(column.key) ? "outlined" : "filled"}
                    onClick={() => setHiddenSources((current) => {
                      const next = new Set(current);
                      if (next.has(column.key)) next.delete(column.key); else next.add(column.key);
                      return next;
                    })}
                  />
                ))}
              </Stack>
            ) : null}
            {!comparisonNotice && comparison.rows.length === 0 ? (
              <Alert severity="info">Confirm at least one dated NZD or AUD financial value to enable comparison.</Alert>
            ) : visibleComparisonColumns.length === 0 ? (
              <Alert severity="info">Select at least one source above.</Alert>
            ) : comparison.rows.length > 0 ? (
              <TableContainer sx={{ overflowX: "auto" }}>
                <Table size="small" aria-label="Confirmed financial values by source">
                  <TableHead><TableRow><TableCell>Metric</TableCell>{visibleComparisonColumns.map((column) => <TableCell key={column.key} align="right">{column.label}</TableCell>)}</TableRow></TableHead>
                  <TableBody>
                    {comparison.rows.map(([metricKey, values]) => (
                      <TableRow key={metricKey} hover>
                        <TableCell>{FINANCIAL_METRIC_LABELS[metricKey as keyof typeof FINANCIAL_METRIC_LABELS] ?? metricKey}</TableCell>
                        {visibleComparisonColumns.map((column) => {
                          const metric = values.get(column.key);
                          return (
                            <TableCell key={column.key} align="right">
                              {metric ? (
                                <Stack spacing={0.15} alignItems="flex-end">
                                  <Typography variant="body2" fontWeight={650}>{formatMetricValue(metric)}</Typography>
                                  <Typography variant="caption" sx={{ color: tokens.textMuted }}>{metric.reportingDate} · {Math.round(metric.confidence * 100)}%</Typography>
                                </Stack>
                              ) : "—"}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : null}
          </Stack>
        </Paper>
      ) : null}
    </Stack>
  );
}
