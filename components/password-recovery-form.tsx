"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { Alert, Button, Paper, Stack, TextField, Typography } from "@mui/material";
import { authCardStyles, authFieldStyles } from "@/components/auth-ui";

export function PasswordRecoveryForm() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      await fetch("/api/auth/password/reset-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
    } finally {
      setSent(true);
      setSubmitting(false);
    }
  };

  return (
    <Paper component="form" onSubmit={submit} elevation={0} sx={cardStyles}>
      <Stack spacing={2.5}>
        <Stack spacing={0.5}>
          <Typography variant="overline" sx={{ color: "#93c5fd" }}>AI-BOSS</Typography>
          <Typography variant="h4" color="common.white" fontWeight={700}>Reset your password</Typography>
          <Typography sx={{ color: "rgba(255,255,255,0.68)" }}>Enter your email and we’ll send a secure recovery link if an account is available.</Typography>
        </Stack>
        {sent ? <Alert severity="success">If an account exists for that email, a password recovery link has been sent.</Alert> : null}
        <TextField label="Email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} sx={authFieldStyles} />
        <Button type="submit" variant="contained" disabled={submitting} sx={buttonStyles}>{submitting ? "Sending…" : "Send recovery link"}</Button>
        <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.68)" }}>Remembered it? <Link href="/sign-in" style={{ color: "#bfdbfe" }}>Sign in</Link></Typography>
      </Stack>
    </Paper>
  );
}

const cardStyles = authCardStyles;
const buttonStyles = { py: 1.5, borderRadius: "999px" };
