"use client";

import { Alert } from "@mui/material";

export function WidgetUnavailableState({ message }: { message: string }) {
  return <Alert severity="info">{message}</Alert>;
}
