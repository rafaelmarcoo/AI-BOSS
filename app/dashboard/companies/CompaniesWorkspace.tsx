"use client";

import { useEffect, useState } from "react";
import { Alert, Box, Chip, CircularProgress, Stack, Typography } from "@mui/material";
import ApartmentRoundedIcon from "@mui/icons-material/ApartmentRounded";
import BusinessCenterOutlinedIcon from "@mui/icons-material/BusinessCenterOutlined";
import type { CompanySummary } from "@/lib/company-analysis/persistence";
import { dashboardTokens } from "@/app/theme";

interface CompaniesResponse {
  success: boolean;
  data?: { companies: CompanySummary[] };
  error?: { message?: string };
}

export function CompaniesWorkspace() {
  const [companies, setCompanies] = useState<CompanySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const sortedCompanies = [...companies].sort(
    (left, right) => Number(right.isOwn) - Number(left.isOwn) || left.name.localeCompare(right.name),
  );

  return (
    <Stack spacing={3}>
      <Stack direction="row" spacing={1.5} alignItems="flex-start">
        <Box sx={{ display: "grid", placeItems: "center", width: 44, height: 44, borderRadius: 2.5, bgcolor: "rgba(59,130,246,0.16)", color: "#93c5fd", flex: "0 0 auto" }}>
          <ApartmentRoundedIcon />
        </Box>
        <Stack spacing={0.5}>
          <Typography variant="h5" fontWeight={700} color="common.white">Companies</Typography>
          <Typography variant="body2" sx={{ color: dashboardTokens.textMuted }}>
            Companies whose financial statements you can analyse and compare in chat.
          </Typography>
        </Stack>
      </Stack>

      {error ? <Alert severity="error">{error}</Alert> : null}

      {loading ? (
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
            </Box>
          ))}
        </Stack>
      )}
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
