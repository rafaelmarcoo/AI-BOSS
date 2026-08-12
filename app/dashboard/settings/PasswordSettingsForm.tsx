"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Paper, Stack, TextField, Typography } from "@mui/material";

export function PasswordSettingsForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const currentPassword = String(formData.get("currentPassword") ?? "");
    const newPassword = String(formData.get("newPassword") ?? "");
    const confirmPassword = String(formData.get("confirmPassword") ?? "");
    setError(null);
    setSuccess(null);

    if (newPassword.length < 8) return setError("Your new password must be at least 8 characters long.");
    if (newPassword !== confirmPassword) return setError("The new passwords do not match.");

    setSubmitting(true);
    try {
      const response = await fetch("/api/auth/password/change", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const payload = (await response.json()) as { success: boolean; error?: { message?: string } };

      if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message ?? "Could not update your password.");
      }

      setSuccess("Password updated. Sign in again with your new password.");
      window.setTimeout(() => router.replace("/sign-in"), 900);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not update your password.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Paper component="form" onSubmit={submit} elevation={0} sx={{ p: { xs: 2, sm: 3 }, bgcolor: "rgba(255,255,255,0.03)", border: "1px solid", borderColor: "rgba(255,255,255,0.10)", color: "common.white" }}>
      <Stack spacing={2}>
        <Stack spacing={0.4}>
          <Typography variant="h6" fontWeight={700}>Change password</Typography>
          <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.65)" }}>For security, enter your current password. You’ll then sign in again with the new one.</Typography>
        </Stack>
        {error ? <Alert severity="error">{error}</Alert> : null}
        {success ? <Alert severity="success">{success}</Alert> : null}
        <TextField name="currentPassword" label="Current password" type="password" autoComplete="current-password" required disabled={submitting} sx={fieldStyles} />
        <TextField name="newPassword" label="New password" type="password" autoComplete="new-password" required disabled={submitting} sx={fieldStyles} />
        <TextField name="confirmPassword" label="Confirm new password" type="password" autoComplete="new-password" required disabled={submitting} sx={fieldStyles} />
        <Button type="submit" variant="contained" disabled={submitting} sx={{ alignSelf: "flex-start" }}>{submitting ? "Updating…" : "Update password"}</Button>
      </Stack>
    </Paper>
  );
}

const fieldStyles = {
  "& .MuiOutlinedInput-root": { color: "common.white", bgcolor: "rgba(255,255,255,0.05)" },
  "& .MuiInputLabel-root": { color: "rgba(255,255,255,0.70)" },
};
