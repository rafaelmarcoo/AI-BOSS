"use client";

import { useEffect, useState } from "react";
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
  Stack,
  Typography,
} from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import ApartmentRoundedIcon from "@mui/icons-material/ApartmentRounded";
import BusinessCenterOutlinedIcon from "@mui/icons-material/BusinessCenterOutlined";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import type { CompanySummary } from "@/lib/company-analysis/persistence";
import { dashboardTokens } from "@/app/theme";
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
  const [adding, setAdding] = useState(false);
  const [companyToDelete, setCompanyToDelete] = useState<CompanySummary | null>(null);
  const [deleting, setDeleting] = useState(false);

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
    setAdding(false);
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
          <Box sx={{ display: "grid", placeItems: "center", width: 44, height: 44, borderRadius: 2.5, bgcolor: "rgba(59,130,246,0.16)", color: "#93c5fd", flex: "0 0 auto" }}>
            <ApartmentRoundedIcon />
          </Box>
          <Stack spacing={0.5}>
            <Typography variant="h5" fontWeight={700} color="common.white">Companies</Typography>
            <Typography variant="body2" sx={{ color: dashboardTokens.textMuted }}>
              Companies you can analyse and compare in chat.
            </Typography>
          </Stack>
        </Stack>
        <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => { setNotice(null); setAdding(true); }} sx={{ borderRadius: 2, whiteSpace: "nowrap", flex: "0 0 auto" }}>
          Add company
        </Button>
      </Stack>

      {notice ? <Alert severity="success" onClose={() => setNotice(null)}>{notice}</Alert> : null}
      {error ? <Alert severity="error" onClose={() => setError(null)}>{error}</Alert> : null}

      {loading && companies.length === 0 ? (
        <Stack alignItems="center" sx={{ py: 8 }}><CircularProgress /></Stack>
      ) : companies.length === 0 ? (
        <Box sx={emptyStateStyles}>
          <ApartmentRoundedIcon sx={{ fontSize: 36, color: dashboardTokens.textMuted }} />
          <Typography color="common.white" fontWeight={600}>No companies yet</Typography>
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
                  <Box sx={{ width: 40, height: 40, display: "grid", placeItems: "center", borderRadius: 2, color: "#bfdbfe", bgcolor: "rgba(59,130,246,0.13)", flex: "0 0 auto" }}>
                    <BusinessCenterOutlinedIcon fontSize="small" />
                  </Box>
                  <Stack spacing={0.6} sx={{ minWidth: 0 }}>
                    <Typography color="common.white" fontWeight={700} sx={{ overflowWrap: "anywhere" }}>
                      {company.name}
                    </Typography>
                    <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                      <Chip
                        label={company.isOwn ? "Added by you" : "Case study"}
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
                {company.isOwn ? (
                  <Button
                    color="error"
                    startIcon={<DeleteOutlineRoundedIcon />}
                    onClick={() => setCompanyToDelete(company)}
                    sx={{ borderRadius: 2, px: 1.25, alignSelf: { xs: "flex-start", sm: "center" }, flex: "0 0 auto" }}
                  >
                    Delete
                  </Button>
                ) : null}
              </Stack>
            </Box>
          ))}
        </Stack>
      )}

      <AddCompanyDialog
        open={adding}
        companies={sortedCompanies}
        onClose={() => setAdding(false)}
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
  bgcolor: "rgba(255,255,255,0.035)",
};

const detailChipStyles = {
  bgcolor: "rgba(255,255,255,0.065)",
  color: "rgba(255,255,255,0.72)",
};

const ownChipStyles = { color: "#86efac", borderColor: "#86efac" };
const caseStudyChipStyles = { color: "#93c5fd", borderColor: "#93c5fd" };
