"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { Alert, Button, Paper, Stack, TextField, Typography } from "@mui/material";

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
          <Typography variant="overline" color="primary">AI-BOSS</Typography>
          <Typography variant="h4" fontWeight={700}>Reset your password</Typography>
          <Typography color="text.secondary">Enter your email and we’ll send a secure recovery link if an account is available.</Typography>
        </Stack>
        {sent ? <Alert severity="success">If an account exists for that email, a password recovery link has been sent.</Alert> : null}
        <TextField label="Email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
        <Button type="submit" variant="contained" disabled={submitting} sx={buttonStyles}>{submitting ? "Sending…" : "Send recovery link"}</Button>
        <Typography variant="body2" color="text.secondary">Remembered it? <Link href="/sign-in">Sign in</Link></Typography>
      </Stack>
    </Paper>
  );
}

const cardStyles = { width: "100%", maxWidth: 448, p: { xs: 3, sm: 4 }, borderRadius: "2rem", border: "1px solid", borderColor: "divider", boxShadow: "0 24px 80px rgba(15, 23, 42, 0.10)" };
const buttonStyles = { py: 1.5, borderRadius: "999px" };
