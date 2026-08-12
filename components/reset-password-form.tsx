"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Alert, Button, Paper, Stack, TextField, Typography } from "@mui/material";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import { authCardStyles, authFieldStyles } from "@/components/auth-ui";

export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [ready, setReady] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const recoveryChecked = useRef(false);

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    const code = searchParams.get("code");

    async function validateRecoveryLink() {
      if (recoveryChecked.current) return;
      recoveryChecked.current = true;

      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) setLinkError("This recovery link is invalid or has expired. Request a new one.");
      }

      const { data } = await supabase.auth.getSession();
      if (!data.session) setLinkError("This recovery link is invalid or has expired. Request a new one.");
      setReady(true);
    }

    void validateRecoveryLink();
  }, [searchParams]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const password = String(formData.get("password") ?? "");
    const confirmPassword = String(formData.get("confirmPassword") ?? "");
    setError(null);

    if (password.length < 8) return setError("Your new password must be at least 8 characters long.");
    if (password !== confirmPassword) return setError("The passwords do not match.");

    setSubmitting(true);
    const supabase = createBrowserSupabaseClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError("Could not reset your password. Request a new recovery link and try again.");
      setSubmitting(false);
      return;
    }

    await supabase.auth.signOut();
    router.replace("/sign-in?reset=success");
  };

  return (
    <Paper component="form" onSubmit={submit} elevation={0} sx={cardStyles}>
      <Stack spacing={2.5}>
        <Stack spacing={0.5}>
          <Typography variant="overline" sx={{ color: "#93c5fd" }}>AI-BOSS</Typography>
          <Typography variant="h4" color="common.white" fontWeight={700}>Choose a new password</Typography>
        </Stack>
        {!ready ? <Typography sx={{ color: "rgba(255,255,255,0.68)" }}>Checking your recovery link…</Typography> : null}
        {linkError ? <Alert severity="error">{linkError}</Alert> : null}
        {error ? <Alert severity="error">{error}</Alert> : null}
        {!linkError ? <>
          <TextField name="password" label="New password" type="password" autoComplete="new-password" required disabled={!ready || submitting} sx={authFieldStyles} />
          <TextField name="confirmPassword" label="Confirm new password" type="password" autoComplete="new-password" required disabled={!ready || submitting} sx={authFieldStyles} />
          <Button type="submit" variant="contained" disabled={!ready || submitting} sx={buttonStyles}>{submitting ? "Saving…" : "Reset password"}</Button>
        </> : null}
      </Stack>
    </Paper>
  );
}

const cardStyles = authCardStyles;
const buttonStyles = { py: 1.5, borderRadius: "999px" };
