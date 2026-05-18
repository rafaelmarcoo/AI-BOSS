"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import SyncProblemIcon from "@mui/icons-material/SyncProblem";
import { useRouter } from "next/navigation";
import { dashboardTokens } from "@/app/theme";
import { XeroConnect } from "@/components/xero-connect";

const PROVIDERS = [
  {
    provider: "xero",
    label: "Xero",
    shortLabel: "X",
    color: "#13B5EA",
    note: "Stable demo connector",
  },
  {
    provider: "quickbooks",
    label: "QuickBooks",
    shortLabel: "Q",
    color: "#2CA01C",
    note: "OAuth backend ready",
  },
  {
    provider: "freshbooks",
    label: "FreshBooks",
    shortLabel: "F",
    color: "#0075DD",
    note: "OAuth backend ready",
  },
  {
    provider: "myob",
    label: "MYOB",
    shortLabel: "M",
    color: "#7B2D8B",
    note: "OAuth backend ready",
  },
] as const;

type Provider = (typeof PROVIDERS)[number]["provider"];

interface ProviderStatus {
  provider: Provider;
  status: "connected" | "disconnected" | "available" | "error";
  displayName: string | null;
  connectedAt: string | null;
  lastSyncedAt: string | null;
}

function formatDate(value: string | null) {
  if (!value) return null;

  return new Intl.DateTimeFormat("en-NZ", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function AccountingConnect() {
  const router = useRouter();
  const [selectedProvider, setSelectedProvider] = useState<Provider>("xero");
  const [statuses, setStatuses] = useState<Record<string, ProviderStatus>>({});
  const [loadingStatuses, setLoadingStatuses] = useState(true);
  const [busyAction, setBusyAction] = useState<"sync" | "disconnect" | null>(
    null,
  );
  const [toast, setToast] = useState<{
    message: string;
    severity: "success" | "error";
  } | null>(null);

  const selected = useMemo(
    () => PROVIDERS.find((provider) => provider.provider === selectedProvider)!,
    [selectedProvider],
  );
  const selectedStatus = statuses[selectedProvider];
  const isConnected = selectedStatus?.status === "connected";

  const loadStatuses = useCallback(async () => {
    setLoadingStatuses(true);

    try {
      const response = await fetch("/api/integrations/status", {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Could not load accounting connection statuses.");
      }

      const payload = (await response.json()) as { data: ProviderStatus[] };
      setStatuses(
        Object.fromEntries(
          payload.data.map((status) => [status.provider, status]),
        ),
      );
    } catch {
      setToast({
        message: "Could not load accounting connection statuses.",
        severity: "error",
      });
    } finally {
      setLoadingStatuses(false);
    }
  }, []);

  useEffect(() => {
    void loadStatuses();
  }, [loadStatuses]);

  async function handleSync() {
    if (!isConnected) return;

    setBusyAction("sync");
    try {
      const response = await fetch(`/api/integrations/sync/${selectedProvider}`, {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Sync failed.");
      }

      setToast({
        message: `${selected.label} data refreshed.`,
        severity: "success",
      });
      await loadStatuses();
      router.refresh();
    } catch {
      setToast({
        message: `Could not sync ${selected.label}.`,
        severity: "error",
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleDisconnect() {
    if (!isConnected) return;

    setBusyAction("disconnect");
    try {
      const response = await fetch(
        `/api/integrations/disconnect/${selectedProvider}`,
        {
          method: "DELETE",
          credentials: "include",
        },
      );

      if (!response.ok) {
        throw new Error("Disconnect failed.");
      }

      setToast({
        message: `${selected.label} disconnected.`,
        severity: "success",
      });
      await loadStatuses();
      router.refresh();
    } catch {
      setToast({
        message: `Could not disconnect ${selected.label}.`,
        severity: "error",
      });
    } finally {
      setBusyAction(null);
    }
  }

  if (selectedProvider === "xero") {
    return (
      <Stack spacing={1.5}>
        <ProviderSelect
          selectedProvider={selectedProvider}
          onChange={setSelectedProvider}
        />
        <XeroConnect onStatusChange={() => void loadStatuses()} />
      </Stack>
    );
  }

  return (
    <>
      <Stack spacing={1.5}>
        <ProviderSelect
          selectedProvider={selectedProvider}
          onChange={setSelectedProvider}
        />

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
                  bgcolor: selected.color,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "common.white",
                  fontWeight: 800,
                  flex: "0 0 auto",
                }}
              >
                {selected.shortLabel}
              </Box>

              <Stack spacing={0.5} sx={{ minWidth: 0 }}>
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                  <Typography variant="subtitle1" fontWeight={700}>
                    {selected.label}
                  </Typography>
                  {loadingStatuses ? (
                    <Chip
                      size="small"
                      icon={<CircularProgress size={14} color="inherit" />}
                      label="Checking"
                      sx={{ color: dashboardTokens.textMuted }}
                    />
                  ) : isConnected ? (
                    <Chip
                      size="small"
                      icon={<CheckCircleIcon />}
                      label="Connected"
                      color="success"
                      variant="outlined"
                    />
                  ) : (
                    <Chip
                      size="small"
                      icon={<SyncProblemIcon />}
                      label="Available"
                      sx={{
                        color: dashboardTokens.textMuted,
                        borderColor: dashboardTokens.borderMuted,
                      }}
                      variant="outlined"
                    />
                  )}
                </Stack>

                <Typography variant="body2" sx={{ color: dashboardTokens.textMuted }}>
                  {isConnected
                    ? selectedStatus?.displayName ?? "Accounting data connected"
                    : selected.note}
                </Typography>
                {selectedStatus?.connectedAt ? (
                  <Typography
                    variant="caption"
                    sx={{ color: dashboardTokens.textMuted }}
                  >
                    Connected {formatDate(selectedStatus.connectedAt)}
                    {selectedStatus.lastSyncedAt
                      ? ` · Last synced ${formatDate(selectedStatus.lastSyncedAt)}`
                      : ""}
                  </Typography>
                ) : null}
              </Stack>
            </Stack>

            {isConnected ? (
              <Stack direction="row" spacing={1} flexShrink={0}>
                <Button
                  type="button"
                  variant="outlined"
                  size="small"
                  startIcon={
                    busyAction === "sync" ? (
                      <CircularProgress size={14} color="inherit" />
                    ) : (
                      <SyncIcon />
                    )
                  }
                  onClick={() => void handleSync()}
                  disabled={busyAction !== null}
                  sx={{
                    borderRadius: 1,
                    color: "rgba(255,255,255,0.75)",
                    borderColor: dashboardTokens.borderMuted,
                  }}
                >
                  Sync
                </Button>
                <Button
                  type="button"
                  variant="outlined"
                  size="small"
                  startIcon={
                    busyAction === "disconnect" ? (
                      <CircularProgress size={14} color="inherit" />
                    ) : (
                      <LinkOffIcon />
                    )
                  }
                  onClick={() => void handleDisconnect()}
                  disabled={busyAction !== null}
                  sx={{
                    borderRadius: 1,
                    color: "#fca5a5",
                    borderColor: "rgba(252, 165, 165, 0.35)",
                  }}
                >
                  Disconnect
                </Button>
              </Stack>
            ) : (
              <Button
                type="button"
                variant="contained"
                size="small"
                startIcon={<LinkIcon />}
                href={`/api/integrations/connect/${selectedProvider}`}
                disabled={loadingStatuses}
                sx={{
                  borderRadius: 1,
                  bgcolor: selected.color,
                  color: "common.white",
                  fontWeight: 700,
                  "&:hover": { bgcolor: selected.color },
                }}
              >
                Connect
              </Button>
            )}
          </Stack>
        </Paper>
      </Stack>

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

function ProviderSelect({
  selectedProvider,
  onChange,
}: {
  selectedProvider: Provider;
  onChange: (provider: Provider) => void;
}) {
  return (
    <Stack spacing={0.75}>
      <Typography
        variant="caption"
        sx={{
          color: dashboardTokens.textMuted,
          textTransform: "uppercase",
          letterSpacing: 0.8,
        }}
      >
        Accounting provider
      </Typography>
      <Select
        size="small"
        value={selectedProvider}
        onChange={(event) => onChange(event.target.value as Provider)}
        sx={{
          maxWidth: 280,
          color: "common.white",
          bgcolor: "rgba(255,255,255,0.04)",
          borderRadius: 1,
          ".MuiOutlinedInput-notchedOutline": {
            borderColor: dashboardTokens.borderMuted,
          },
          ".MuiSvgIcon-root": { color: dashboardTokens.textMuted },
        }}
      >
        {PROVIDERS.map((provider) => (
          <MenuItem key={provider.provider} value={provider.provider}>
            {provider.label}
          </MenuItem>
        ))}
      </Select>
    </Stack>
  );
}
