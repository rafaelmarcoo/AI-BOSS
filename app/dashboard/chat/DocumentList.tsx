"use client";

import {
  Alert,
  Box,
  Chip,
  Collapse,
  CircularProgress,
  Stack,
  Typography,
} from "@mui/material";
import DescriptionRoundedIcon from "@mui/icons-material/DescriptionRounded";
import KeyboardArrowDownRoundedIcon from "@mui/icons-material/KeyboardArrowDownRounded";
import type { DocumentSummaryView } from "./types";
import { dashboardTokens } from "@/app/theme";

interface DocumentListProps {
  documents: DocumentSummaryView[];
  loading: boolean;
  error: string | null;
  open: boolean;
  onToggle: () => void;
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
  open,
  onToggle,
}: DocumentListProps) {
  const pendingCount = documents.filter((document) =>
    ["uploaded", "processing"].includes(document.status)
  ).length;

  return (
    <Stack
      sx={{
        borderBottom: "1px solid",
        borderBottomColor: dashboardTokens.border,
        bgcolor: "rgba(255,255,255,0.02)",
      }}
    >
      <Box
        component="button"
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls="chat-documents-panel"
        sx={{
          appearance: "none",
          width: "100%",
          border: 0,
          px: 1.25,
          py: 0.85,
          bgcolor: "transparent",
          color: "inherit",
          cursor: "pointer",
          textAlign: "left",
          "&:focus-visible": {
            outline: "2px solid rgba(96, 165, 250, 0.65)",
            outlineOffset: -2,
          },
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1}>
          <DescriptionRoundedIcon
            fontSize="small"
            sx={{ color: dashboardTokens.textMuted, flex: "0 0 auto" }}
          />
          <Stack sx={{ minWidth: 0, flex: 1 }}>
            <Typography
              variant="caption"
              sx={{
                color: dashboardTokens.textMuted,
                textTransform: "uppercase",
                letterSpacing: 0.8,
                lineHeight: 1.2,
              }}
            >
              Documents
            </Typography>
            <Typography
              variant="caption"
              sx={{
                color: "common.white",
                lineHeight: 1.25,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {documents.length === 0
                ? "No documents"
                : `${documents.length} document${documents.length === 1 ? "" : "s"}`}
              {pendingCount > 0 ? ` · ${pendingCount} processing` : ""}
            </Typography>
          </Stack>
          {loading ? (
            <CircularProgress
              size={14}
              sx={{ color: dashboardTokens.textMuted, flex: "0 0 auto" }}
            />
          ) : null}
          <KeyboardArrowDownRoundedIcon
            fontSize="small"
            sx={{
              color: dashboardTokens.textMuted,
              transform: open ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 160ms ease",
              flex: "0 0 auto",
            }}
          />
        </Stack>
      </Box>

      <Collapse in={open} timeout={160} unmountOnExit>
        <Stack
          id="chat-documents-panel"
          spacing={1}
          sx={{
            px: 1.25,
            pb: 1,
            maxHeight: 260,
            overflow: "auto",
          }}
        >
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
      </Collapse>
    </Stack>
  );
}
