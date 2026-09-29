"use client";

import { Alert } from "@mui/material";

export function WidgetErrorState({ message }: { message: string }) {
  return <Alert severity="error">{message}</Alert>;
}
