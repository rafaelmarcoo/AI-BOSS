"use client";

import { Box, Chip, Paper, Stack, Typography } from "@mui/material";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import DescriptionIcon from "@mui/icons-material/Description";
import TableChartIcon from "@mui/icons-material/TableChart";
import { dashboardTokens } from "@/app/theme";
// --- COMMENTED OUT: XeroConnect and separate provider cards replaced by unified dropdown ---
// import { XeroConnect } from "@/components/xero-connect";
// import { AccountingProviderCard, type ProviderStatus } from "@/components/accounting-provider-card";
// const ACCOUNTING_PROVIDERS = [{ provider: "quickbooks", ... }, { provider: "freshbooks", ... }, { provider: "myob", ... }]
// --- END COMMENTED OUT ---

// --- START: unified accounting connect imports ---
import { useCallback, useEffect, useState } from "react";
import { Alert, Snackbar } from "@mui/material";
import { AccountingConnectCard } from "@/components/accounting-connect-card";
import type { ProviderStatus } from "@/lib/integrations/types";
// --- END: unified accounting connect imports ---

const UPCOMING_SOURCES = [
  {
    label: "CSV uploads",
    description: "Upload in chat today. Dashboard metric extraction is next.",
    icon: TableChartIcon,
    status: "Chat ready",
  },
  {
    label: "PDF reports",
    description: "Upload in chat today. Structured extraction is coming later.",
    icon: DescriptionIcon,
    status: "Chat ready",
  },
  {
    label: "Bank feeds",
    description: "Live transaction data for cash visibility",
    icon: AccountBalanceWalletIcon,
    status: "Soon",
  },
];

// --- COMMENTED OUT: replaced with lint-safe version below ---
// type IntegrationStatusMap = Record<string, ProviderStatus>;
// export function DataSourcesPanel() {
//   const [integrationStatuses, setIntegrationStatuses] = useState<IntegrationStatusMap>({});
//   const [toast, setToast] = useState<{ message: string; severity: "success" | "error" } | null>(null);
//   const fetchStatuses = useCallback(async () => {
//     try {
//       const res = await fetch("/api/integrations/status", { credentials: "include" });
//       if (!res.ok) return;
//       const payload = (await res.json()) as { data: Array<{ provider: string } & ProviderStatus> };
//       const map: IntegrationStatusMap = {};
//       for (const entry of payload.data) { map[entry.provider] = entry; }
//       setIntegrationStatuses(map);
//     } catch {}
//   }, []);
//   useEffect(() => {
//     fetchStatuses();
//     const params = new URLSearchParams(window.location.search);
//     const connected = params.get("integration_connected");
//     const errored = params.get("integration_error");
//     if (connected || errored) {
//       const url = new URL(window.location.href);
//       url.searchParams.delete("integration_connected");
//       url.searchParams.delete("integration_error");
//       window.history.replaceState({}, "", url.toString());
//       if (connected) { setToast({ message: `${connected.charAt(0).toUpperCase() + connected.slice(1)} connected successfully.`, severity: "success" }); }
//       else if (errored) { setToast({ message: `Could not connect ${errored}. Please try again.`, severity: "error" }); }
//     }
//   }, [fetchStatuses]);
// --- END COMMENTED OUT ---

// --- START: accounting integrations state and fetch (lint-safe) ---
type IntegrationStatusMap = Record<string, ProviderStatus>;

function getInitialToast() {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const connected = params.get("integration_connected");
  const errored = params.get("integration_error");
  if (connected) {
    return {
      message: `${connected.charAt(0).toUpperCase() + connected.slice(1)} connected successfully.`,
      severity: "success" as const,
    };
  }
  if (errored) {
    return {
      message: `Could not connect ${errored}. Please try again.`,
      severity: "error" as const,
    };
  }
  return null;
}

export function DataSourcesPanel() {
  const [integrationStatuses, setIntegrationStatuses] =
    useState<IntegrationStatusMap>({});
  const [toast, setToast] = useState<{
    message: string;
    severity: "success" | "error";
  } | null>(getInitialToast);

  const loadStatuses = useCallback(() => {
    fetch("/api/integrations/status", { credentials: "include" })
      .then((res) => res.json())
      .then((payload: { data: Array<{ provider: string } & ProviderStatus> }) => {
        const map: IntegrationStatusMap = {};
        for (const entry of payload.data) {
          map[entry.provider] = entry;
        }
        setIntegrationStatuses(map);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadStatuses();
  }, [loadStatuses]);

  // Clean integration query params from URL after reading them on mount
  useEffect(() => {
    const url = new URL(window.location.href);
    if (
      url.searchParams.has("integration_connected") ||
      url.searchParams.has("integration_error")
    ) {
      url.searchParams.delete("integration_connected");
      url.searchParams.delete("integration_error");
      window.history.replaceState({}, "", url.toString());
    }
  }, []);
// --- END: accounting integrations state and fetch ---

  return (
    <Paper
      elevation={0}
      sx={{
        p: 3,
        borderRadius: 1,
        bgcolor: dashboardTokens.runwayV2,
        color: "common.white",
        border: "1px solid",
        borderColor: dashboardTokens.border,
      }}
    >
      <Stack spacing={2.5}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1.5}
          alignItems={{ xs: "flex-start", sm: "center" }}
          justifyContent="space-between"
        >
          <Stack spacing={0.5}>
            <Typography variant="h6" fontWeight={700}>
              Connect data sources
            </Typography>
            <Typography variant="body2" sx={{ color: dashboardTokens.textMuted }}>
              Connected systems and uploaded files will feed source-aware metrics.
            </Typography>
          </Stack>

          <Chip
            size="small"
            label="Metric extraction next"
            sx={{
              color: dashboardTokens.textSoft,
              borderColor: dashboardTokens.borderMuted,
            }}
            variant="outlined"
          />
        </Stack>

        {/* --- COMMENTED OUT: replaced by unified AccountingConnectCard dropdown ---
        <XeroConnect />
        <Stack spacing={1.5}>
          {ACCOUNTING_PROVIDERS.map((p) => (
            <AccountingProviderCard key={p.provider} ... />
          ))}
        </Stack>
        --- END COMMENTED OUT --- */}

        {/* --- START: unified accounting connect dropdown --- */}
        <AccountingConnectCard
          statuses={integrationStatuses}
          onRefresh={loadStatuses}
        />
        {/* --- END: unified accounting connect dropdown --- */}

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" },
            gap: 1.5,
          }}
        >
          {UPCOMING_SOURCES.map((source) => {
            const Icon = source.icon;

            return (
              <Paper
                key={source.label}
                elevation={0}
                sx={{
                  p: 2,
                  borderRadius: 1,
                  bgcolor: "rgba(255, 255, 255, 0.03)",
                  border: "1px dashed",
                  borderColor: dashboardTokens.borderMuted,
                  color: "common.white",
                  minHeight: 116,
                }}
              >
                <Stack spacing={1.25}>
                  <Stack
                    direction="row"
                    spacing={1}
                    alignItems="center"
                    justifyContent="space-between"
                  >
                    <Box
                      sx={{
                        width: 32,
                        height: 32,
                        borderRadius: 1,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        bgcolor: "rgba(255, 255, 255, 0.06)",
                      }}
                    >
                      <Icon sx={{ fontSize: 18, color: dashboardTokens.textSoft }} />
                    </Box>
                    <Chip
                      size="small"
                      label={source.status}
                      sx={{
                        color: dashboardTokens.textMuted,
                        borderColor: dashboardTokens.border,
                      }}
                      variant="outlined"
                    />
                  </Stack>

                  <Stack spacing={0.5}>
                    <Typography variant="subtitle2" fontWeight={700}>
                      {source.label}
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{ color: dashboardTokens.textMuted }}
                    >
                      {source.description}
                    </Typography>
                  </Stack>
                </Stack>
              </Paper>
            );
          })}
        </Box>
      </Stack>

      {/* --- START: integration toast notification --- */}
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
      {/* --- END: integration toast notification --- */}
    </Paper>
  );
}
