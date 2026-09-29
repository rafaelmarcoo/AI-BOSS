"use client";

import { Alert } from "@mui/material";

export function WidgetPartialState({ message }: { message: string }) {
  return <Alert severity="warning">Partial data: {message}</Alert>;
}
