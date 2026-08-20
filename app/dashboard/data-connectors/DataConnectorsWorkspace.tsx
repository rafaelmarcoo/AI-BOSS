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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      try {
        const [statusResponse, documentsResponse] = await Promise.all([
          fetch("/api/integrations/status", { credentials: "include" }),
          fetch("/api/documents", { credentials: "include" }),
        ]);

        const statusPayload =
          (await statusResponse.json()) as ProviderStatusApiResponse;
        const documentsPayload =
          (await documentsResponse.json()) as DocumentsApiResponse;

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

        if (isMounted) {
          setConnections(statusPayload.data);
          setDocuments(documentsPayload.data.documents);
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

  return (
    <Stack spacing={4}>
      <Box>
        <Typography variant="h6" fontWeight={700} sx={{ mb: 0.5 }}>
          Data Connectors
        </Typography>
        <Typography variant="body2" sx={{ color: dashboardTokens.textMuted }}>
          Connect accounting sources and see everything you've linked in — accounting
          connections and uploaded documents — in one place.
        </Typography>
      </Box>

      <AccountingConnect />

      <Box>
        <Typography component="h2" sx={{ fontSize: 15, fontWeight: 600, mb: 1.5 }}>
          Everything linked in
        </Typography>

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
                {rows.map((row) => (
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
    </Stack>
  );
}
