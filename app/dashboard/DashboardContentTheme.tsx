"use client";

import type { ReactNode } from "react";
import { ThemeProvider } from "@mui/material";
import { dashboardCanvasTheme } from "@/app/theme";

export function DashboardContentTheme({ children }: { children: ReactNode }) {
  return <ThemeProvider theme={dashboardCanvasTheme}>{children}</ThemeProvider>;
}
