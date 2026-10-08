"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
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
  Menu,
  MenuItem,
  Stack,
  Typography,
} from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import ApartmentRoundedIcon from "@mui/icons-material/ApartmentRounded";
import BusinessCenterOutlinedIcon from "@mui/icons-material/BusinessCenterOutlined";
import CompareArrowsRoundedIcon from "@mui/icons-material/CompareArrowsRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import UploadFileRoundedIcon from "@mui/icons-material/UploadFileRounded";
import type { CompanySummary } from "@/lib/company-analysis/persistence";
import { dashboardCanvasTokens as dashboardTokens } from "@/app/theme";
import { downloadCompanyFigures, downloadStatementTemplate, type TemplateKind } from "@/lib/company-analysis/download-template";
import { AddCompanyDialog } from "./AddCompanyDialog";

interface CompaniesResponse {
  success: boolean;
  data?: { companies: CompanySummary[] };
  error?: { message?: string };
}

export function CompaniesWorkspace() {
  const [companies, setCompanies] = useState<CompanySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ key: number; editing: CompanySummary | null; file: File | null }>({
    key: 0,
    editing: null,
    file: null,
  });
  const [dialogOpen, setDialogOpen] = useState(false);
  const newFiguresInput = useRef<HTMLInputElement>(null);
  const newFiguresFor = useRef<CompanySummary | null>(null);

  const openDialog = (editing: CompanySummary | null, file: File | null = null) => {
    setNotice(null);
    setDialog((current) => ({ key: current.key + 1, editing, file }));
    setDialogOpen(true);
  };

  const chooseNewFigures = (company: CompanySummary) => {
    newFiguresFor.current = company;
    newFiguresInput.current?.click();
  };

  const newFiguresChosen = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file && newFiguresFor.current) openDialog(newFiguresFor.current, file);
  };
  const [companyToDelete, setCompanyToDelete] = useState<CompanySummary | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [templateMenu, setTemplateMenu] = useState<HTMLElement | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [copyingId, setCopyingId] = useState<string | null>(null);

  const copyCompany = async (company: CompanySummary) => {
    setCopyingId(company.id);
    setNotice(null);
    try {
      const response = await fetch(`/api/companies/${encodeURIComponent(company.id)}/copy`, { method: "POST" });
      const payload = (await response.json()) as { success: boolean; message?: string; error?: { message?: string } };
      if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message ?? "Could not copy the company.");
      }
      setNotice(payload.message ?? `${company.name} was copied.`);
      void loadCompanies();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not copy the company.");
    } finally {
      setCopyingId(null);
    }
  };

  const downloadFigures = async (company: CompanySummary) => {
    setDownloadingId(company.id);
    try {
      await downloadCompanyFigures(company.id);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not download the figures.");
    } finally {
      setDownloadingId(null);
    }
  };

  const downloadTemplate = (kind: TemplateKind) => {
    setTemplateMenu(null);
    downloadStatementTemplate(kind).catch(() => setError("Could not create the template. Please try again."));
  };

  const loadCompanies = async () => {
    setLoading(true);

    try {
      const response = await fetch("/api/companies");
      const payload = (await response.json()) as CompaniesResponse;

      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error?.message ?? "Could not load companies.");
      }

      setCompanies(payload.data.companies);
      setError(null);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not load companies.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadCompanies();
  }, []);

  const companySaved = (message: string) => {
    setDialogOpen(false);
    setNotice(message);
    void loadCompanies();
  };

  const confirmDelete = async () => {
    if (!companyToDelete) return;

    setDeleting(true);
    try {
      const response = await fetch(`/api/companies/${encodeURIComponent(companyToDelete.id)}`, {
        method: "DELETE",
      });
      const payload = (await response.json()) as {
        success: boolean;
        error?: { message?: string };
      };

      if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message ?? "Could not delete the company.");
      }

      setNotice(`${companyToDelete.name} was deleted.`);
      setCompanyToDelete(null);
      void loadCompanies();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not delete the company.",
      );
      setCompanyToDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  const sortedCompanies = [...companies].sort(
    (left, right) => Number(right.isOwn) - Number(left.isOwn) || left.name.localeCompare(right.name),
  );

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} justifyContent="space-between" alignItems={{ xs: "stretch", sm: "flex-start" }}>
        <Stack direction="row" spacing={1.5} alignItems="flex-start">
          <Box sx={{ display: "grid", placeItems: "center", width: 44, height: 44, borderRadius: 2.5, bgcolor: dashboardTokens.surfaceSoft, color: dashboardTokens.text, flex: "0 0 auto" }}>
            <ApartmentRoundedIcon />
          </Box>
          <Stack spacing={0.5}>
            <Typography variant="h5" fontWeight={700} color={dashboardTokens.text}>Companies</Typography>
            <Typography variant="body2" sx={{ color: dashboardTokens.textMuted }}>
              Companies you can analyse and compare in chat.
            </Typography>
          </Stack>
        </Stack>
        <Stack direction="row" spacing={1} sx={{ flex: "0 0 auto" }}>
          <Button variant="outlined" startIcon={<CompareArrowsRoundedIcon />} href="/dashboard/companies/compare" sx={{ borderRadius: 2, whiteSpace: "nowrap" }}>
            Compare
          </Button>
          <Button variant="outlined" startIcon={<DownloadRoundedIcon />} onClick={(event) => setTemplateMenu(event.currentTarget)} sx={{ borderRadius: 2, whiteSpace: "nowrap" }}>
            Template
          </Button>
          <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => openDialog(null)} sx={{ borderRadius: 2, whiteSpace: "nowrap" }}>
            Add company
          </Button>
        </Stack>
        <Menu anchorEl={templateMenu} open={Boolean(templateMenu)} onClose={() => setTemplateMenu(null)}>
          <MenuItem onClick={() => downloadTemplate("blank")}>Blank template (to fill in)</MenuItem>
          <MenuItem onClick={() => downloadTemplate("example")}>Example: Ressett (to look at)</MenuItem>
        </Menu>
      </Stack>

      {notice ? <Alert severity="success" onClose={() => setNotice(null)}>{notice}</Alert> : null}
      {error ? <Alert severity="error" onClose={() => setError(null)}>{error}</Alert> : null}

      {loading && companies.length === 0 ? (
        <Stack alignItems="center" sx={{ py: 8 }}><CircularProgress /></Stack>
      ) : companies.length === 0 ? (
        <Box sx={emptyStateStyles}>
          <ApartmentRoundedIcon sx={{ fontSize: 36, color: dashboardTokens.textMuted }} />
          <Typography color={dashboardTokens.text} fontWeight={600}>No companies yet</Typography>
        </Box>
      ) : (
        <Stack spacing={1.25}>
          <Typography variant="caption" sx={{ color: dashboardTokens.textMuted, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase" }}>
            {companies.length} {companies.length === 1 ? "company" : "companies"}
          </Typography>
          {sortedCompanies.map((company) => (
            <Box key={company.id} sx={companyCardStyles}>
              <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={2}>
                <Stack direction="row" spacing={1.5} sx={{ minWidth: 0 }}>
                  <Box sx={{ width: 40, height: 40, display: "grid", placeItems: "center", borderRadius: 2, color: dashboardTokens.text, bgcolor: dashboardTokens.surfaceSoft, flex: "0 0 auto" }}>
                    <BusinessCenterOutlinedIcon fontSize="small" />
                  </Box>
                  <Stack spacing={0.6} sx={{ minWidth: 0 }}>
                    <Typography color={dashboardTokens.text} fontWeight={700} sx={{ overflowWrap: "anywhere" }}>
                      {company.name}
                    </Typography>
                    <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                      <Chip
                        label={company.isOwn ? "Added by you" : "Shared case study (read-only)"}
                        size="small"
                        variant="outlined"
                        sx={company.isOwn ? ownChipStyles : caseStudyChipStyles}
                      />
                      <Chip label={`${company.currency} ${company.amountsIn}`} size="small" sx={detailChipStyles} />
                      {company.industry ? (
                        <Typography variant="caption" sx={{ color: dashboardTokens.textMuted, alignSelf: "center" }}>
                          {company.industry}
                        </Typography>
                      ) : null}
                    </Stack>
                    <Typography variant="caption" sx={{ color: dashboardTokens.textMuted }}>
                      {company.competitors.length > 0
                        ? `Competes with ${company.competitors.join(", ")}`
                        : "No competitors added yet"}
                    </Typography>
                    <Typography variant="caption" sx={{ color: dashboardTokens.textMuted, overflowWrap: "anywhere" }}>
                      Source: {company.source}
                    </Typography>
                  </Stack>
                </Stack>
                <Stack direction={{ xs: "row", sm: "column" }} spacing={0.5} sx={{ alignSelf: { xs: "flex-start", sm: "center" }, flex: "0 0 auto" }}>
                  {company.isOwn ? (
                    <>
                      <Button
                        startIcon={<UploadFileRoundedIcon />}
                        onClick={() => chooseNewFigures(company)}
                        sx={{ borderRadius: 2, px: 1.25, whiteSpace: "nowrap", justifyContent: "flex-start" }}
                      >
                        Upload new figures
                      </Button>
                      <Button
                        startIcon={<EditRoundedIcon />}
                        onClick={() => openDialog(company)}
                        sx={{ borderRadius: 2, px: 1.25, whiteSpace: "nowrap", justifyContent: "flex-start" }}
                      >
                        Edit details
                      </Button>
                    </>
                  ) : null}
                  <Button
                    startIcon={<CompareArrowsRoundedIcon />}
                    href={`/dashboard/companies/compare?first=${encodeURIComponent(company.id)}`}
                    sx={{ borderRadius: 2, px: 1.25, whiteSpace: "nowrap", justifyContent: "flex-start" }}
                  >
                    Compare
                  </Button>
                  {!company.isOwn ? (
                    <Button
                      startIcon={<ContentCopyRoundedIcon />}
                      disabled={copyingId === company.id}
                      onClick={() => void copyCompany(company)}
                      sx={{ borderRadius: 2, px: 1.25, whiteSpace: "nowrap", justifyContent: "flex-start" }}
                    >
                      {copyingId === company.id ? "Copying…" : "Copy to my companies"}
                    </Button>
                  ) : null}
                  <Button
                    startIcon={<DownloadRoundedIcon />}
                    disabled={downloadingId === company.id}
                    onClick={() => void downloadFigures(company)}
                    sx={{ borderRadius: 2, px: 1.25, whiteSpace: "nowrap", justifyContent: "flex-start" }}
                  >
                    {downloadingId === company.id ? "Downloading…" : "Download figures"}
                  </Button>
                  {company.isOwn ? (
                    <Button
                      color="error"
                      startIcon={<DeleteOutlineRoundedIcon />}
                      onClick={() => setCompanyToDelete(company)}
                      sx={{ borderRadius: 2, px: 1.25, justifyContent: "flex-start" }}
                    >
                      Delete
                    </Button>
                  ) : null}
                </Stack>
              </Stack>
            </Box>
          ))}
        </Stack>
      )}

      <input ref={newFiguresInput} hidden type="file" accept=".csv,text/csv" onChange={newFiguresChosen} />

      <AddCompanyDialog
        key={dialog.key}
        open={dialogOpen}
        companies={sortedCompanies}
        editing={dialog.editing}
        initialFile={dialog.file}
        onClose={() => setDialogOpen(false)}
        onSaved={companySaved}
      />

      <Dialog open={Boolean(companyToDelete)} onClose={() => !deleting && setCompanyToDelete(null)}>
        <DialogTitle>Delete {companyToDelete?.name}?</DialogTitle>
        <DialogContent>
          <Typography>
            This removes the company and its figures for good. You can add it back by uploading the file again.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button disabled={deleting} onClick={() => setCompanyToDelete(null)}>Cancel</Button>
          <Button color="error" variant="contained" disabled={deleting} onClick={() => void confirmDelete()}>
            {deleting ? "Deleting…" : "Delete permanently"}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

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

const companyCardStyles = {
  p: { xs: 1.5, sm: 2 },
  borderRadius: 3,
  border: "1px solid",
  borderColor: dashboardTokens.border,
  bgcolor: dashboardTokens.surface,
};

const detailChipStyles = {
  bgcolor: dashboardTokens.surfaceAlt,
  color: dashboardTokens.textSoft,
};

const ownChipStyles = { color: dashboardTokens.positive, borderColor: dashboardTokens.positive };
const caseStudyChipStyles = { color: dashboardTokens.textSoft, borderColor: dashboardTokens.borderSoft };
