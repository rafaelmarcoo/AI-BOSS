"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  MenuItem,
  Paper,
  Select,
  Snackbar,
  Stack,
  Typography,
} from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import LinkIcon from "@mui/icons-material/Link";
import LinkOffIcon from "@mui/icons-material/LinkOff";
import SyncIcon from "@mui/icons-material/Sync";
import { dashboardTokens } from "@/app/theme";
import type { ProviderStatus } from "@/lib/integrations/types";

const PROVIDERS = [
  {
    provider: "quickbooks",
    label: "QuickBooks",
    color: "#2CA01C",
    description: "Connect QuickBooks for accounting data.",
  },
  {
    provider: "xero",
    label: "Xero",
    color: "#13B5EA",
    description: "Connect Xero for accounting and payroll data.",
  },
  {
    provider: "freshbooks",
    label: "FreshBooks",
    color: "#0075DD",
    description: "Connect FreshBooks for invoicing and expense data.",
  },
  {
    provider: "myob",
    label: "MYOB",
    color: "#7B2D8B",
    description: "Connect MYOB for accounting and payroll data.",
  },
] as const;

type Provider = (typeof PROVIDERS)[number]["provider"];

interface AccountingConnectCardProps {
  statuses: Record<string, ProviderStatus>;
  onRefresh: () => void;
}

function formatDate(value: string | null) {
  if (!value) return null;
  return new Intl.DateTimeFormat("en-NZ", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function AccountingConnectCard({
  statuses,
  onRefresh,
}: AccountingConnectCardProps) {
  const router = useRouter();
  const [selectedProvider, setSelectedProvider] = useState<Provider>(
    "quickbooks"
  );
  const [isSyncing, setIsSyncing] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    severity: "success" | "error";
  } | null>(null);

  const isLoadingStatuses = Object.keys(statuses).length === 0;
  const connectedEntry = PROVIDERS.find(
    (p) => statuses[p.provider]?.status === "connected"
  );
  const connectedStatus = connectedEntry
    ? statuses[connectedEntry.provider]
    : null;

  async function handleSync() {
    if (!connectedEntry) return;
    setIsSyncing(true);
    try {
      const res = await fetch(
        `/api/integrations/sync/${connectedEntry.provider}`,
        { method: "POST", credentials: "include" }
      );
      if (!res.ok) throw new Error("Sync failed");
      setToast({
        message: `${connectedEntry.label} data refreshed.`,
        severity: "success",
      });
      onRefresh();
      router.refresh();
    } catch {
      setToast({
        message: `Could not sync ${connectedEntry?.label}. Please try again.`,
        severity: "error",
      });
    } finally {
      setIsSyncing(false);
    }
  }

  async function handleDisconnect() {
    if (!connectedEntry) return;
    setIsDisconnecting(true);
    try {
      const res = await fetch(
        `/api/integrations/disconnect/${connectedEntry.provider}`,
        { method: "DELETE", credentials: "include" }
      );
      if (!res.ok) throw new Error("Disconnect failed");
      setToast({
        message: `${connectedEntry.label} disconnected.`,
        severity: "success",
      });
      onRefresh();
      router.refresh();
    } catch {
      setToast({
        message: `Could not disconnect ${connectedEntry?.label}. Please try again.`,
        severity: "error",
      });
    } finally {
      setIsDisconnecting(false);
    }
  }

  const selected = PROVIDERS.find((p) => p.provider === selectedProvider)!;

  return (
    <>
      <Paper
        elevation={0}
        sx={{
          p: 2.5,
          borderRadius: 1,
          bgcolor: dashboardTokens.surface,
          border: "1px solid",
          borderColor: dashboardTokens.border,
          color: "common.white",
        }}
      >
        <Stack spacing={2}>
          <Typography variant="subtitle1" fontWeight={700}>
            Accounting Software
          </Typography>

          {isLoadingStatuses ? (
            <Stack direction="row" spacing={1} alignItems="center">
              <CircularProgress size={16} color="inherit" />
              <Typography variant="body2" sx={{ color: dashboardTokens.textMuted }}>
                Checking connection...
              </Typography>
            </Stack>
          ) : connectedEntry ? (
            /* --- Connected state: no dropdown, just provider info + actions --- */
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={2}
              alignItems={{ xs: "stretch", sm: "center" }}
              justifyContent="space-between"
            >
              <Stack direction="row" spacing={1.5} alignItems="center">
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: 1,
                    bgcolor: connectedEntry.color,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 800,
                    fontSize: "0.9rem",
                    flexShrink: 0,
                  }}
                >
                  {connectedEntry.label.charAt(0)}
                </Box>
                <Stack spacing={0.5}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="subtitle2" fontWeight={700}>
                      {connectedEntry.label}
                    </Typography>
                    <Chip
                      size="small"
                      icon={<CheckCircleIcon />}
                      label="Connected"
                      color="success"
                      variant="outlined"
                    />
                  </Stack>
                  <Typography
                    variant="body2"
                    sx={{ color: dashboardTokens.textMuted }}
                  >
                    {connectedStatus?.displayName ?? connectedEntry.label}
                  </Typography>
                  {connectedStatus?.connectedAt && (
                    <Typography
                      variant="caption"
                      sx={{ color: dashboardTokens.textMuted }}
                    >
                      Connected {formatDate(connectedStatus.connectedAt)}
                      {connectedStatus.lastSyncedAt
                        ? ` · Last synced ${formatDate(connectedStatus.lastSyncedAt)}`
                        : ""}
                    </Typography>
                  )}
                </Stack>
              </Stack>

              <Stack direction="row" spacing={1} flexShrink={0}>
                <Button
                  type="button"
                  variant="outlined"
                  size="small"
                  startIcon={
                    isSyncing ? (
                      <CircularProgress size={14} color="inherit" />
                    ) : (
                      <SyncIcon />
                    )
                  }
                  onClick={handleSync}
                  disabled={isSyncing || isDisconnecting}
                  sx={{
                    borderRadius: 1,
                    color: "rgba(255,255,255,0.7)",
                    borderColor: "rgba(255,255,255,0.2)",
                  }}
                >
                  {isSyncing ? "Syncing" : "Sync"}
                </Button>
                <Button
                  type="button"
                  variant="outlined"
                  size="small"
                  startIcon={
                    isDisconnecting ? (
                      <CircularProgress size={14} color="inherit" />
                    ) : (
                      <LinkOffIcon />
                    )
                  }
                  onClick={handleDisconnect}
                  disabled={isDisconnecting || isSyncing}
                  sx={{
                    borderRadius: 1,
                    color: "#fca5a5",
                    borderColor: "rgba(252, 165, 165, 0.35)",
                  }}
                >
                  {isDisconnecting ? "Disconnecting" : "Disconnect"}
                </Button>
              </Stack>
            </Stack>
          ) : (
            /* --- Disconnected state: dropdown + Connect button --- */
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={2}
              alignItems={{ xs: "stretch", sm: "center" }}
              justifyContent="space-between"
            >
              <Stack spacing={0.75} sx={{ flex: 1, minWidth: 0 }}>
                <Select
                  size="small"
                  value={selectedProvider}
                  onChange={(e) =>
                    setSelectedProvider(e.target.value as Provider)
                  }
                  sx={{
                    color: "common.white",
                    borderColor: dashboardTokens.border,
                    maxWidth: 220,
                    ".MuiOutlinedInput-notchedOutline": {
                      borderColor: dashboardTokens.border,
                    },
                    "&:hover .MuiOutlinedInput-notchedOutline": {
                      borderColor: dashboardTokens.textSoft,
                    },
                    ".MuiSvgIcon-root": { color: "rgba(255,255,255,0.5)" },
                  }}
                >
                  {PROVIDERS.map((p) => (
                    <MenuItem key={p.provider} value={p.provider}>
                      {p.label}
                    </MenuItem>
                  ))}
                </Select>
                <Typography
                  variant="body2"
                  sx={{ color: dashboardTokens.textMuted }}
                >
                  {selected.description}
                </Typography>
              </Stack>

              <Button
                type="button"
                variant="contained"
                size="small"
                startIcon={<LinkIcon />}
                href={`/api/integrations/connect/${selectedProvider}`}
                sx={{
                  borderRadius: 1,
                  bgcolor: selected.color,
                  color: "common.white",
                  fontWeight: 700,
                  flexShrink: 0,
                  "&:hover": { bgcolor: selected.color, opacity: 0.88 },
                }}
              >
                Connect
              </Button>
            </Stack>
          )}
        </Stack>
      </Paper>

      <Snackbar
        open={toast !== null}
        autoHideDuration={5000}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          severity={toast?.severity}
          variant="filled"
          onClose={() => setToast(null)}
        >
          {toast?.message}
        </Alert>
      </Snackbar>
    </>
  );
}
