"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Snackbar,
  Stack,
  Typography,
} from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import LinkIcon from "@mui/icons-material/Link";
import LinkOffIcon from "@mui/icons-material/LinkOff";
import SyncProblemIcon from "@mui/icons-material/SyncProblem";
import { dashboardTokens } from "@/app/theme";

interface XeroStatus {
  connected: boolean;
  demo?: boolean;
  tenantName?: string;
  connectedAt?: string;
  expiresAt?: string | null;
}

interface XeroConnectProps {
  onStatusChange?: (connected: boolean) => void;
}

function formatConnectionDate(value?: string) {
  if (!value) return null;

  return new Intl.DateTimeFormat("en-NZ", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function XeroConnect({ onStatusChange }: XeroConnectProps) {
  const [status, setStatus] = useState<XeroStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    severity: "success" | "error";
  } | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/xero/status", {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to load Xero status.");
      }

      const payload = (await response.json()) as { data: XeroStatus };
      setStatus(payload.data);
      onStatusChange?.(payload.data.connected);
    } catch {
      setStatus({ connected: false });
      onStatusChange?.(false);
    } finally {
      setIsLoading(false);
    }
  }, [onStatusChange]);

  useEffect(() => {
    fetchStatus();

    const params = new URLSearchParams(window.location.search);
    const xeroStatus = params.get("xero");

    if (!xeroStatus) return;

    const url = new URL(window.location.href);
    url.searchParams.delete("xero");
    window.history.replaceState({}, "", url.toString());

    if (xeroStatus === "connected") {
      setToast({ message: "Xero connected.", severity: "success" });
    } else if (xeroStatus === "no_tenant") {
      setToast({
        message: "No Xero organisation was found for this account.",
        severity: "error",
      });
    } else {
      setToast({
        message: "Xero connection failed. You can try again.",
        severity: "error",
      });
    }
  }, [fetchStatus]);

  async function handleDisconnect() {
    setIsDisconnecting(true);

    try {
      const response = await fetch("/api/xero/disconnect", {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to disconnect Xero.");
      }

      setStatus({ connected: false });
      onStatusChange?.(false);
      setToast({ message: "Xero disconnected.", severity: "success" });
    } catch {
      setToast({
        message: "Could not disconnect Xero. Please try again.",
        severity: "error",
      });
    } finally {
      setIsDisconnecting(false);
    }
  }

  const connectedAt = formatConnectionDate(status?.connectedAt);

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
                bgcolor: "#13B5EA",
                color: "common.white",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 800,
                fontSize: "0.9rem",
              }}
            >
              X
            </Box>

            <Stack spacing={0.5} sx={{ minWidth: 0 }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="subtitle1" fontWeight={700}>
                  Xero
                </Typography>
                {isLoading ? (
                  <Chip
                    size="small"
                    icon={<CircularProgress size={14} color="inherit" />}
                    label="Checking"
                    sx={{ color: dashboardTokens.textMuted }}
                  />
                ) : status?.connected ? (
                  <>
                    <Chip
                      size="small"
                      icon={<CheckCircleIcon />}
                      label="Connected"
                      color="success"
                      variant="outlined"
                    />
                    {status.demo ? (
                      <Chip
                        size="small"
                        label="Demo"
                        sx={{
                          color: "#facc15",
                          borderColor: "rgba(250, 204, 21, 0.4)",
                        }}
                        variant="outlined"
                      />
                    ) : null}
                  </>
                ) : (
                  <Chip
                    size="small"
                    icon={<SyncProblemIcon />}
                    label="Disconnected"
                    sx={{
                      color: dashboardTokens.textMuted,
                      borderColor: dashboardTokens.borderMuted,
                    }}
                    variant="outlined"
                  />
                )}
              </Stack>

              <Typography variant="body2" sx={{ color: dashboardTokens.textMuted }}>
                {status?.demo
                  ? "Demo Xero data is enabled for this environment."
                  : status?.connected
                  ? status.tenantName ?? "Accounting data connected"
                  : "Connect accounting data for source-aware metrics."}
              </Typography>
              {connectedAt ? (
                <Typography
                  variant="caption"
                  sx={{ color: dashboardTokens.textMuted }}
                >
                  Connected {connectedAt}
                </Typography>
              ) : null}
            </Stack>
          </Stack>

          {status?.connected && !status.demo ? (
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
              disabled={isDisconnecting}
              sx={{
                borderRadius: 1,
                color: "#fca5a5",
                borderColor: "rgba(252, 165, 165, 0.35)",
              }}
            >
              {isDisconnecting ? "Disconnecting" : "Disconnect"}
            </Button>
          ) : status?.connected && status.demo ? (
            <Button
              type="button"
              variant="outlined"
              size="small"
              disabled
              sx={{
                borderRadius: 1,
                color: dashboardTokens.textMuted,
                borderColor: dashboardTokens.borderMuted,
              }}
            >
              Demo mode
            </Button>
          ) : (
            <Button
              type="button"
              variant="contained"
              size="small"
              startIcon={<LinkIcon />}
              href="/api/xero/connect"
              disabled={isLoading}
              sx={{
                borderRadius: 1,
                bgcolor: "#13B5EA",
                color: "common.white",
                fontWeight: 700,
                "&:hover": { bgcolor: "#0f9fd0" },
              }}
            >
              Connect
            </Button>
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
