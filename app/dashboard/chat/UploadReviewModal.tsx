"use client";

import {
  Box,
  CircularProgress,
  Dialog,
  IconButton,
  Stack,
  Typography,
} from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import { dashboardTokens } from "@/app/theme";
import type { DocumentSummaryView } from "./types";

interface UploadReviewModalProps {
  uploading: boolean;
  document: DocumentSummaryView | null;
  onClose: () => void;
}

export function UploadReviewModal({
  uploading,
  document,
  onClose,
}: UploadReviewModalProps) {
  const isOpen = uploading || Boolean(document);
  const isProcessing =
    !uploading &&
    (document?.status === "uploaded" || document?.status === "processing");

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      fullWidth
      maxWidth="lg"
      PaperProps={{
        sx: {
          height: "80vh",
          maxHeight: "80vh",
          bgcolor: "#111218",
          color: "common.white",
          border: "1px solid",
          borderColor: dashboardTokens.border,
        },
      }}
    >
      <Box
        sx={{
          display: "flex",
          justifyContent: "flex-end",
          p: 1,
        }}
      >
        <IconButton
          aria-label="Close"
          onClick={onClose}
          size="small"
          sx={{ color: dashboardTokens.textMuted }}
        >
          <CloseRoundedIcon fontSize="small" />
        </IconButton>
      </Box>

      <Box
        sx={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          px: 4,
          pb: 4,
        }}
      >
        {uploading || isProcessing ? (
          <Stack spacing={2} alignItems="center">
            <CircularProgress />
            <Typography variant="h6" sx={{ color: dashboardTokens.text }}>
              {uploading ? "Uploading..." : "Processing..."}
            </Typography>
          </Stack>
        ) : document?.status === "failed" ? (
          <Stack spacing={1.5} alignItems="center" sx={{ maxWidth: 480, textAlign: "center" }}>
            <Typography variant="h6" sx={{ color: "#fca5a5" }}>
              Something went wrong
            </Typography>
            <Typography variant="body2" sx={{ color: dashboardTokens.textMuted }}>
              {document.error_message ?? `${document.file_name} could not be processed.`}
            </Typography>
          </Stack>
        ) : document?.status === "ready" ? (
          <Stack spacing={1.5} alignItems="center" sx={{ maxWidth: 480, textAlign: "center" }}>
            <Typography variant="h6" sx={{ color: dashboardTokens.text }}>
              {document.file_name} is ready
            </Typography>
            <Typography variant="body2" sx={{ color: dashboardTokens.textMuted }}>
              A review table of the extracted data will show here next.
            </Typography>
          </Stack>
        ) : null}
      </Box>
    </Dialog>
  );
}
