"use client";

import { Typography } from "@mui/material";
import { dashboardCanvasTokens as dashboardTokens } from "@/app/theme";
import { DataSourcesPanel } from "@/components/data-sources-panel";
import type { DataConnectionsWidget as DataConnectionsWidgetModel } from "@/lib/gen-ui/types";
import { WidgetFrame } from "../../shared/WidgetFrame";

export function DataConnectionsWidgetView({
  widget,
}: {
  widget: DataConnectionsWidgetModel;
}) {
  return (
    <WidgetFrame title={widget.title} reason={widget.reason}>
      <Typography variant="body2" sx={{ color: dashboardTokens.textMuted }}>
        {widget.data.message}
      </Typography>
      <DataSourcesPanel />
    </WidgetFrame>
  );
}
