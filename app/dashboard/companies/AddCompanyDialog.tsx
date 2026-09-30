"use client";

import { useState, type ChangeEvent } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import UploadFileRoundedIcon from "@mui/icons-material/UploadFileRounded";
import type { StatementUploadReview } from "@/lib/company-analysis/statement-upload";
import { statementTableRows } from "@/lib/company-analysis/statement-template";
import { dashboardTokens } from "@/app/theme";

interface PreviewResponse {
  success: boolean;
  data?: { review: StatementUploadReview };
  error?: { message?: string };
}

interface AddCompanyDialogProps {
  open: boolean;
  onClose: () => void;
}

export function AddCompanyDialog({ open, onClose }: AddCompanyDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [review, setReview] = useState<StatementUploadReview | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    if (checking) return;
    setFile(null);
    setReview(null);
    setError(null);
    onClose();
  };

  const chooseFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const chosen = event.target.files?.[0];
    event.target.value = "";
    if (!chosen) return;

    setFile(chosen);
    setReview(null);
    setError(null);
    setChecking(true);

    try {
      const body = new FormData();
      body.set("file", chosen);
      const response = await fetch("/api/companies/preview", { method: "POST", body });
      const payload = (await response.json()) as PreviewResponse;

      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error?.message ?? "Could not read the file.");
      }

      setReview(payload.data.review);
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Could not read the file.",
      );
    } finally {
      setChecking(false);
    }
  };

  return (
    <Dialog open={open} onClose={close} fullWidth maxWidth="md" scroll="paper">
      <DialogTitle>Add a company</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Typography variant="body2" sx={{ color: dashboardTokens.textMuted }}>
            Upload the company&apos;s financial statements as a CSV using the template: one line per row,
            one year per column. Nothing is saved until you confirm.
          </Typography>

          <Stack direction="row" spacing={1.5} alignItems="center">
            <Button
              component="label"
              variant={review ? "outlined" : "contained"}
              startIcon={<UploadFileRoundedIcon />}
              disabled={checking}
              sx={{ borderRadius: 2, whiteSpace: "nowrap" }}
            >
              {file ? "Choose a different file" : "Choose CSV file"}
              <input hidden type="file" accept=".csv,text/csv" onChange={(event) => void chooseFile(event)} />
            </Button>
            {file ? (
              <Typography variant="body2" sx={{ color: dashboardTokens.textMuted, overflowWrap: "anywhere" }}>
                {file.name}
              </Typography>
            ) : null}
          </Stack>

          {checking ? (
            <Stack direction="row" spacing={1.5} alignItems="center">
              <CircularProgress size={20} />
              <Typography variant="body2">Reading and checking the file…</Typography>
            </Stack>
          ) : null}

          {error ? <Alert severity="error">{error}</Alert> : null}

          {review ? <ReviewSummary review={review} /> : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={close} disabled={checking}>Cancel</Button>
      </DialogActions>
    </Dialog>
  );
}

function ReviewSummary({ review }: { review: StatementUploadReview }) {
  return (
    <Stack spacing={2}>
      {review.errors.length > 0 ? (
        <Alert severity="error">
          <Typography variant="body2" fontWeight={600}>
            Fix these in the file, then choose it again:
          </Typography>
          <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
            {review.errors.map((message) => <li key={message}>{message}</li>)}
          </Box>
        </Alert>
      ) : review.failedChecks.length > 0 ? (
        <Alert severity="warning">
          <Typography variant="body2" fontWeight={600}>
            {review.failedChecks.length} of {review.checksRun} checks did not add up.
            Check these against the original statements:
          </Typography>
          <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
            {review.failedChecks.map((check) => (
              <li key={`${check.fiscalYearEnd}-${check.id}`}>
                {formatYear(check.fiscalYearEnd)}: {check.message}
              </li>
            ))}
          </Box>
        </Alert>
      ) : (
        <Alert severity="success">All {review.checksRun} checks passed. The figures add up.</Alert>
      )}

      {review.unrecognised.length > 0 ? (
        <Alert severity="info">
          <Typography variant="body2" fontWeight={600}>
            These rows were not recognised and will be left out:
          </Typography>
          <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
            {review.unrecognised.map((row) => (
              <li key={row.rowNumber}>Row {row.rowNumber}: {row.label}</li>
            ))}
          </Box>
        </Alert>
      ) : null}

      {review.years.length > 0 ? <StatementTable review={review} /> : null}
    </Stack>
  );
}

function StatementTable({ review }: { review: StatementUploadReview }) {
  const rows = statementTableRows(review.years);

  return (
    <TableContainer sx={{ border: "1px solid", borderColor: dashboardTokens.border, borderRadius: 2 }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Line</TableCell>
            {review.years.map((year) => (
              <TableCell key={year.fiscalYearEnd} align="right" sx={{ whiteSpace: "nowrap" }}>
                {formatYear(year.fiscalYearEnd)}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.label}>
              <TableCell>{row.label}</TableCell>
              {row.values.map((value, index) => (
                <TableCell key={review.years[index].fiscalYearEnd} align="right" sx={{ fontVariantNumeric: "tabular-nums" }}>
                  {formatValue(value, row.isCost)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function formatYear(fiscalYearEnd: string) {
  return new Date(`${fiscalYearEnd}T00:00:00Z`).toLocaleDateString("en-NZ", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatValue(value: number | null, isCost: boolean) {
  if (value === null) return "–";
  const text = Math.abs(value).toLocaleString("en-NZ", { maximumFractionDigits: 4 });
  if (isCost) return `(${text})`;
  return value < 0 ? `-${text}` : text;
}
