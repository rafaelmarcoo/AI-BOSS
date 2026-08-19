"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import DescriptionRoundedIcon from "@mui/icons-material/DescriptionRounded";
import InsertDriveFileOutlinedIcon from "@mui/icons-material/InsertDriveFileOutlined";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import type { DocumentSummary } from "@/lib/documents/types";
import { dashboardTokens } from "@/app/theme";

type FileFilter = "all" | "pdf" | "csv" | "image";
type StatusFilter = "all" | DocumentSummary["status"];
type SortOption = "newest" | "oldest" | "name";

interface DocumentsResponse {
  success: boolean;
  data?: { documents: DocumentSummary[] };
  error?: { message?: string };
}

function statusPresentation(status: DocumentSummary["status"]) {
  if (status === "ready") return { label: "Ready", color: "#86efac" };
  if (status === "failed") return { label: "Failed", color: "#fca5a5" };
  if (status === "processing") return { label: "Processing", color: "#93c5fd" };
  return { label: "Uploaded", color: "#fde68a" };
}

export function DocumentsWorkspace() {
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [fileFilter, setFileFilter] = useState<FileFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<SortOption>("newest");
  const [documentToDelete, setDocumentToDelete] = useState<DocumentSummary | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadDocuments = async () => {
    setLoading(true);

    try {
      const response = await fetch("/api/documents");
      const payload = (await response.json()) as DocumentsResponse;

      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error?.message ?? "Could not load documents.");
      }

      setDocuments(payload.data.documents);
      setError(null);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not load documents.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDocuments();
  }, []);

  const visibleDocuments = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const filtered = documents.filter((document) => {
      const matchesFile = fileFilter === "all" || document.file_type === fileFilter;
      const matchesStatus = statusFilter === "all" || document.status === statusFilter;
      const matchesSearch =
        !normalizedSearch || document.file_name.toLowerCase().includes(normalizedSearch);

      return matchesFile && matchesStatus && matchesSearch;
    });

    return filtered.sort((left, right) => {
      if (sort === "name") return left.file_name.localeCompare(right.file_name);
      const difference = new Date(left.created_at).getTime() - new Date(right.created_at).getTime();
      return sort === "newest" ? -difference : difference;
    });
  }, [documents, fileFilter, search, sort, statusFilter]);

  const confirmDelete = async () => {
    if (!documentToDelete) return;

    setDeleting(true);
    try {
      const response = await fetch(`/api/documents/${documentToDelete.id}`, {
        method: "DELETE",
      });
      const payload = (await response.json()) as {
        success: boolean;
        error?: { message?: string };
      };

      if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message ?? "Could not delete the document.");
      }

      setDocuments((current) =>
        current.filter((document) => document.id !== documentToDelete.id),
      );
      setDocumentToDelete(null);
      setError(null);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not delete the document.",
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Stack spacing={3}>
      <Stack direction="row" spacing={1.5} alignItems="flex-start">
        <Box sx={{ display: "grid", placeItems: "center", width: 44, height: 44, borderRadius: 2.5, bgcolor: "rgba(59,130,246,0.16)", color: "#93c5fd", flex: "0 0 auto" }}>
          <DescriptionRoundedIcon />
        </Box>
        <Stack spacing={0.5}>
          <Typography variant="h5" fontWeight={700} color="common.white">Documents</Typography>
          <Typography variant="body2" sx={{ color: dashboardTokens.textMuted }}>
            Manage your uploaded PDFs, CSVs, and images. Removing a CSV also removes its derived dashboard, history, and forecast data.
          </Typography>
        </Stack>
      </Stack>

      <Box sx={{ p: { xs: 1.25, sm: 1.5 }, border: "1px solid", borderColor: dashboardTokens.border, borderRadius: 3, bgcolor: "rgba(255,255,255,0.025)" }}>
      <Stack direction={{ xs: "column", lg: "row" }} spacing={1.25}>
        <TextField
          label="Search documents"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by file name"
          slotProps={{ input: { startAdornment: <SearchRoundedIcon fontSize="small" sx={{ mr: 1, color: dashboardTokens.textMuted }} /> } }}
          sx={{ flex: 1, minWidth: 200, ...fieldStyles }}
        />
        <FilterSelect label="File type" value={fileFilter} onChange={(value) => setFileFilter(value as FileFilter)} options={[["all", "All files"], ["pdf", "PDF"], ["csv", "CSV"], ["image", "Images"]]} />
        <FilterSelect label="Status" value={statusFilter} onChange={(value) => setStatusFilter(value as StatusFilter)} options={[["all", "All statuses"], ["uploaded", "Uploaded"], ["processing", "Processing"], ["ready", "Ready"], ["failed", "Failed"]]} />
        <FilterSelect label="Sort" value={sort} onChange={(value) => setSort(value as SortOption)} options={[["newest", "Newest first"], ["oldest", "Oldest first"], ["name", "Name A–Z"]]} />
      </Stack>
      </Box>

      {error ? <Alert severity="error">{error}</Alert> : null}

      {loading ? (
        <Stack alignItems="center" sx={{ py: 8 }}><CircularProgress /></Stack>
      ) : visibleDocuments.length === 0 ? (
        <Box sx={emptyStateStyles}>
          <DescriptionRoundedIcon sx={{ fontSize: 36, color: dashboardTokens.textMuted }} />
          <Typography color="common.white" fontWeight={600}>
            {documents.length === 0 ? "No documents uploaded yet" : "No documents match these filters"}
          </Typography>
          <Typography variant="body2" sx={{ color: dashboardTokens.textMuted }}>
            Upload a PDF, CSV, or image from chat to add it to your workspace.
          </Typography>
        </Box>
      ) : (
        <Stack spacing={1.25}>
          <Typography variant="caption" sx={{ color: dashboardTokens.textMuted, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase" }}>
            {visibleDocuments.length} {visibleDocuments.length === 1 ? "document" : "documents"}
          </Typography>
          {visibleDocuments.map((document) => {
            const status = statusPresentation(document.status);

            return (
              <Box key={document.id} sx={documentCardStyles}>
                <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={2}>
                  <Stack direction="row" spacing={1.5} sx={{ minWidth: 0 }}>
                    <Box sx={{ width: 40, height: 40, display: "grid", placeItems: "center", borderRadius: 2, color: "#bfdbfe", bgcolor: "rgba(59,130,246,0.13)", flex: "0 0 auto" }}>
                      <InsertDriveFileOutlinedIcon fontSize="small" />
                    </Box>
                    <Stack spacing={0.6} sx={{ minWidth: 0 }}>
                      <Typography color="common.white" fontWeight={700} sx={{ overflowWrap: "anywhere" }}>
                        {document.file_name}
                      </Typography>
                      <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                        <Chip label={document.file_type.toUpperCase()} size="small" sx={fileTypeChipStyles} />
                        <Chip label={status.label} size="small" sx={{ color: status.color, borderColor: status.color }} variant="outlined" />
                        <Typography variant="caption" sx={{ color: dashboardTokens.textMuted, alignSelf: "center" }}>
                          Uploaded {new Date(document.created_at).toLocaleString()}
                        </Typography>
                      </Stack>
                      <Typography variant="caption" sx={{ color: dashboardTokens.textMuted }}>
                        {document.conversation_id ? "Linked to a chat conversation" : "Workspace upload"}
                      </Typography>
                      {document.error_message ? <Alert severity="error">{document.error_message}</Alert> : null}
                    </Stack>
                  </Stack>
                  <Button color="error" startIcon={<DeleteOutlineRoundedIcon />} onClick={() => setDocumentToDelete(document)} sx={{ alignSelf: { xs: "flex-start", sm: "center" }, borderRadius: 2, px: 1.25 }}>
                    Delete
                  </Button>
                </Stack>
              </Box>
            );
          })}
        </Stack>
      )}

      <Dialog open={Boolean(documentToDelete)} onClose={() => !deleting && setDocumentToDelete(null)}>
        <DialogTitle>Delete this document?</DialogTitle>
        <DialogContent>
          <Typography>
            This permanently removes the file, its AI retrieval chunks, and any financial observations extracted from it. Dashboard history and forecasts based on this file will update immediately.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button disabled={deleting} onClick={() => setDocumentToDelete(null)}>Cancel</Button>
          <Button color="error" variant="contained" disabled={deleting} onClick={() => void confirmDelete()}>
            {deleting ? "Deleting…" : "Delete permanently"}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

const fieldStyles = {
  "& .MuiOutlinedInput-root": { bgcolor: "rgba(255,255,255,0.055)", color: "common.white", borderRadius: 2.25 },
  "& .MuiInputLabel-root": { color: dashboardTokens.textMuted },
};

const emptyStateStyles = {
  display: "grid",
  placeItems: "center",
  gap: 1,
  py: 8,
  border: "1px dashed",
  borderColor: dashboardTokens.borderMuted,
  borderRadius: 3,
  textAlign: "center",
};

const documentCardStyles = {
  p: { xs: 1.5, sm: 2 },
  borderRadius: 3,
  border: "1px solid",
  borderColor: dashboardTokens.border,
  bgcolor: "rgba(255,255,255,0.035)",
  transition: "border-color 160ms ease, background-color 160ms ease",
  "&:hover": { borderColor: "rgba(147,197,253,0.30)", bgcolor: "rgba(255,255,255,0.05)" },
};

const fileTypeChipStyles = {
  bgcolor: "rgba(255,255,255,0.065)",
  color: "rgba(255,255,255,0.72)",
};

function FilterSelect({ label, value, onChange, options }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<[string, string]>;
}) {
  return (
    <FormControl size="small" sx={{ minWidth: { xs: "100%", sm: 150 }, ...fieldStyles }}>
      <InputLabel>{label}</InputLabel>
      <Select label={label} value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map(([optionValue, optionLabel]) => <MenuItem key={optionValue} value={optionValue}>{optionLabel}</MenuItem>)}
      </Select>
    </FormControl>
  );
}
