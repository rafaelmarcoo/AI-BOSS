"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import LinkRoundedIcon from "@mui/icons-material/LinkRounded";
import LinkOffRoundedIcon from "@mui/icons-material/LinkOffRounded";
import SyncRoundedIcon from "@mui/icons-material/SyncRounded";
import { dashboardCanvasTokens as tokens } from "@/app/theme";
import type { AccountingProvider, ProviderStatus } from "@/lib/integrations/types";

const PROVIDERS: Array<{
  provider: AccountingProvider;
  label: string;
  shortLabel: string;
  color: string;
}> = [
  { provider: "xero", label: "Xero", shortLabel: "X", color: "#13B5EA" },
  { provider: "quickbooks", label: "QuickBooks", shortLabel: "Q", color: "#2CA01C" },
  { provider: "freshbooks", label: "FreshBooks", shortLabel: "F", color: "#0075DD" },
  { provider: "myob", label: "MYOB", shortLabel: "M", color: "#6E43C0" },
  { provider: "zoho_books", label: "Zoho Books", shortLabel: "Z", color: "#E42527" },
  { provider: "freeagent", label: "FreeAgent", shortLabel: "FA", color: "#4F5D95" },
];

interface StatusResponse {
  success: boolean;
  data?: ProviderStatus[];
  error?: { message?: string };
}

function formatDate(value: string | null) {
  return value
    ? new Intl.DateTimeFormat("en-NZ", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
    : null;
}

export function AccountingConnect({ onChanged }: { onChanged?: () => void } = {}) {
  const [statuses, setStatuses] = useState<Partial<Record<AccountingProvider, ProviderStatus>>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadStatuses = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/integrations/status");
      const payload = (await response.json()) as StatusResponse;
      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error?.message ?? "Could not load provider statuses.");
      }
      setStatuses(Object.fromEntries(payload.data.map((status) => [status.provider, status])));
      setError(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not load provider statuses.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStatuses();
  }, [loadStatuses]);

  const perform = async (
    provider: (typeof PROVIDERS)[number],
    action: "sync" | "disconnect",
  ) => {
    const key = `${provider.provider}:${action}`;
    if (
      action === "disconnect" &&
      !window.confirm(
        `Disconnect ${provider.label}? Its current imported observations will be removed from live calculations. Saved analysis reports remain unchanged.`,
      )
    ) {
      return;
    }

    setBusy(key);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/integrations/${action}/${provider.provider}`, {
        method: action === "sync" ? "POST" : "DELETE",
      });
      const payload = (await response.json()) as StatusResponse;
      if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message ?? `Could not ${action} ${provider.label}.`);
      }
      setNotice(
        action === "sync"
          ? `${provider.label} data refreshed.`
          : `${provider.label} disconnected and removed from live calculations.`,
      );
      await loadStatuses();
      onChanged?.();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : `Could not ${action} ${provider.label}.`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Stack spacing={1.5}>
      <Stack spacing={0.35}>
        <Typography component="h2" variant="h6" fontWeight={700}>Accounting connections</Typography>
        <Typography variant="body2" sx={{ color: tokens.textMuted }}>
          Credentials and OAuth state remain private to your account. Imported financial records are restricted to your company.
        </Typography>
      </Stack>
      {error ? <Alert severity="error" onClose={() => setError(null)}>{error}</Alert> : null}
      {notice ? <Alert severity="success" onClose={() => setNotice(null)}>{notice}</Alert> : null}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" }, gap: 1.25 }}>
        {PROVIDERS.map((provider) => {
          const status = statuses[provider.provider];
          const connected = status?.status === "connected";
          const unavailable = status?.status === "unavailable";
          return (
            <Paper key={provider.provider} variant="outlined" sx={{ p: 2, borderColor: tokens.border, borderRadius: 2.5 }}>
              <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={1.5}>
                <Stack direction="row" spacing={1.25} alignItems="center" sx={{ minWidth: 0 }}>
                  <Box sx={{ width: 40, height: 40, display: "grid", placeItems: "center", borderRadius: 2, bgcolor: provider.color, color: "white", fontWeight: 800, flex: "0 0 auto", fontSize: provider.shortLabel.length > 1 ? 12 : 16 }}>
                    {provider.shortLabel}
                  </Box>
                  <Stack spacing={0.35} sx={{ minWidth: 0 }}>
                    <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
                      <Typography fontWeight={700}>{provider.label}</Typography>
                      {loading ? (
                        <Chip size="small" icon={<CircularProgress size={13} />} label="Checking" />
                      ) : (
                        <Chip
                          size="small"
                          label={unavailable ? "Configuration required" : connected ? "Connected" : status?.status ?? "Available"}
                          color={connected ? "success" : "default"}
                          variant="outlined"
                        />
                      )}
                    </Stack>
                    <Typography variant="caption" sx={{ color: tokens.textMuted, overflowWrap: "anywhere" }}>
                      {connected
                        ? `${status?.displayName ?? "Connected organisation"}${status?.lastSyncedAt ? ` · Synced ${formatDate(status.lastSyncedAt)}` : ""}`
                        : unavailable
                          ? "OAuth credentials are not configured on this environment."
                          : "Ready to connect with OAuth."}
                    </Typography>
                  </Stack>
                </Stack>
                {connected ? (
                  <Stack direction="row" spacing={0.75} sx={{ alignSelf: { sm: "center" } }}>
                    <Button size="small" variant="outlined" startIcon={<SyncRoundedIcon />} disabled={busy !== null} onClick={() => void perform(provider, "sync")}>
                      {busy === `${provider.provider}:sync` ? "Syncing…" : "Sync"}
                    </Button>
                    <Button size="small" color="error" variant="outlined" startIcon={<LinkOffRoundedIcon />} disabled={busy !== null} onClick={() => void perform(provider, "disconnect")}>
                      {busy === `${provider.provider}:disconnect` ? "Disconnecting…" : "Disconnect"}
                    </Button>
                  </Stack>
                ) : (
                  <Button
                    size="small"
                    variant="contained"
                    startIcon={<LinkRoundedIcon />}
                    href={`/api/integrations/connect/${provider.provider}`}
                    disabled={loading || unavailable}
                    sx={{ alignSelf: { sm: "center" } }}
                  >
                    Connect
                  </Button>
                )}
              </Stack>
            </Paper>
          );
        })}
      </Box>
    </Stack>
  );
}
