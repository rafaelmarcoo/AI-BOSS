"use client";

import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  Stack,
  Typography,
} from "@mui/material";
import type { DocumentSummaryView } from "./types";
import { dashboardTokens } from "@/app/theme";

interface DocumentListProps {
  documents: DocumentSummaryView[];
  loading: boolean;
  error: string | null;
}

function getStatusColor(status: DocumentSummaryView["status"]) {
  switch (status) {
    case "ready":
      return {
        label: "Ready",
        borderColor: "rgba(74, 222, 128, 0.28)",
        color: "#86efac",
      };
    case "failed":
      return {
        label: "Failed",
        borderColor: "rgba(248, 113, 113, 0.28)",
        color: "#fca5a5",
      };
    case "processing":
      return {
        label: "Processing",
        borderColor: "rgba(96, 165, 250, 0.28)",
        color: "#93c5fd",
      };
    default:
      return {
        label: "Uploaded",
        borderColor: "rgba(250, 204, 21, 0.28)",
        color: "#fde68a",
      };
  }
}

export function DocumentList({
  documents,
  loading,
  error,
}: DocumentListProps) {
  return (
    <Stack
      spacing={1}
      sx={{
        px: 1.25,
        py: 1,
        borderBottom: "1px solid",
        borderBottomColor: dashboardTokens.border,
        bgcolor: "rgba(255,255,255,0.02)",
      }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Typography
          variant="caption"
          sx={{
            color: dashboardTokens.textMuted,
            textTransform: "uppercase",
            letterSpacing: 0.8,
          }}
        >
          Documents
        </Typography>
        {loading ? (
          <CircularProgress size={14} sx={{ color: dashboardTokens.textMuted }} />
        ) : null}
      </Stack>

      {error ? (
        <Alert severity="error" sx={{ borderRadius: 2 }}>
          {error}
        </Alert>
      ) : null}

      {documents.length === 0 ? (
        <Typography variant="body2" sx={{ color: dashboardTokens.textMuted }}>
          Upload a PDF or CSV to start building your knowledge base.
        </Typography>
      ) : (
        <Stack spacing={0.85}>
          {documents.slice(0, 4).map((document) => {
            const status = getStatusColor(document.status);

            return (
              <Box
                key={document.id}
                sx={{
                  px: 1.1,
                  py: 0.95,
                  borderRadius: 2,
                  border: "1px solid",
                  borderColor: dashboardTokens.border,
                  bgcolor: "rgba(255,255,255,0.03)",
                }}
              >
                <Stack
                  direction="row"
                  spacing={1}
                  alignItems="flex-start"
                  justifyContent="space-between"
                >
                  <Stack spacing={0.35} sx={{ minWidth: 0 }}>
                    <Typography
                      variant="body2"
                      sx={{
                        color: "common.white",
                        fontWeight: 600,
                        lineHeight: 1.3,
                        wordBreak: "break-word",
                      }}
                    >
                      {document.file_name}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{ color: dashboardTokens.textMuted }}
                    >
                      {document.file_type.toUpperCase()} ·{" "}
                      {new Date(document.updated_at).toLocaleString()}
                    </Typography>
                    {document.error_message ? (
                      <Typography
                        variant="caption"
                        sx={{ color: "#fca5a5", lineHeight: 1.35 }}
                      >
                        {document.error_message}
                      </Typography>
                    ) : null}
                  </Stack>

                  <Chip
                    label={status.label}
                    size="small"
                    sx={{
                      color: status.color,
                      border: "1px solid",
                      borderColor: status.borderColor,
                      bgcolor: "transparent",
                      ".MuiChip-label": {
                        px: 1,
                      },
                    }}
                  />
                </Stack>
              </Box>
            );
          })}
        </Stack>
      )}
    </Stack>
  );
}
