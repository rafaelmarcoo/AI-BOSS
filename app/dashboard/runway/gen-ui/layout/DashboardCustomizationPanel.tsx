"use client";

import { useMemo, useState } from "react";
import {
  Button,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import RestartAltRoundedIcon from "@mui/icons-material/RestartAltRounded";
import { dashboardCanvasTokens as dashboardTokens } from "@/app/theme";
import { GEN_UI_WIDGET_CATALOG_ENTRIES } from "@/lib/gen-ui/catalog";
import type { GenUiWidgetType } from "@/lib/gen-ui/types";

const CONVERSATION_ONLY_WIDGETS = new Set<GenUiWidgetType>([
  "scenario_comparison",
  "scenario_analysis",
  "highlight_explainer",
]);

interface DashboardCustomizationPanelProps {
  name: string;
  isDefault: boolean;
  saving: boolean;
  hasAiPlan: boolean;
  canDelete: boolean;
  onNameChange: (name: string) => void;
  onDefaultChange: (isDefault: boolean) => void;
  onAddWidget: (widgetType: GenUiWidgetType) => void;
  onResetToAi: () => void;
  onSave: () => void;
  onCancel: () => void;
  onDelete: () => void;
}

export function DashboardCustomizationPanel({
  name,
  isDefault,
  saving,
  hasAiPlan,
  canDelete,
  onNameChange,
  onDefaultChange,
  onAddWidget,
  onResetToAi,
  onSave,
  onCancel,
  onDelete,
}: DashboardCustomizationPanelProps) {
  const widgetOptions = useMemo(
    () =>
      GEN_UI_WIDGET_CATALOG_ENTRIES.filter(
        (entry) => !CONVERSATION_ONLY_WIDGETS.has(entry.type),
      ).sort((left, right) => left.label.localeCompare(right.label)),
    [],
  );
  const [widgetType, setWidgetType] = useState<GenUiWidgetType>(
    widgetOptions[0].type,
  );
  return (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 2, sm: 2.5 },
        mb: 2,
        bgcolor: dashboardTokens.surface,
        boxShadow: "0 5px 16px rgba(32, 58, 80, 0.06)",
        border: "1px solid",
        borderColor: dashboardTokens.border,
      }}
    >
      <Stack spacing={2.5}>
        <Stack spacing={0.35}>
          <Typography fontWeight={700}>Customize saved layout</Typography>
          <Typography variant="body2" sx={{ color: dashboardTokens.textMuted }}>
            Drag widgets in the canvas to reorder them. Values are refreshed from trusted data and are not saved inside this layout.
          </Typography>
        </Stack>

        <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
          <TextField
            label="Layout name"
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
            size="small"
            fullWidth
            inputProps={{ maxLength: 80 }}
          />
          <FormControlLabel
            control={
              <Switch
                checked={isDefault}
                onChange={(event) => onDefaultChange(event.target.checked)}
              />
            }
            label="Open by default"
            sx={{ minWidth: 176, m: 0 }}
          />
        </Stack>

        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
          <FormControl size="small" fullWidth>
            <InputLabel id="add-dashboard-widget-label">Add widget</InputLabel>
            <Select
              labelId="add-dashboard-widget-label"
              value={widgetType}
              label="Add widget"
              onChange={(event) => setWidgetType(event.target.value as GenUiWidgetType)}
            >
              {widgetOptions.map((entry) => (
                <MenuItem key={entry.type} value={entry.type}>
                  {entry.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button
            variant="outlined"
            startIcon={<AddRoundedIcon />}
            onClick={() => onAddWidget(widgetType)}
            sx={{ whiteSpace: "nowrap" }}
          >
            Add widget
          </Button>
        </Stack>

        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Button
            variant="contained"
            disabled={saving || name.trim().length === 0}
            onClick={onSave}
          >
            {saving ? "Saving…" : "Save layout"}
          </Button>
          <Button variant="outlined" disabled={saving} onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant="outlined"
            startIcon={<RestartAltRoundedIcon />}
            disabled={saving || !hasAiPlan}
            onClick={onResetToAi}
          >
            Reset to AI layout
          </Button>
          {canDelete ? (
            <Button color="error" variant="text" disabled={saving} onClick={onDelete}>
              Delete layout
            </Button>
          ) : null}
        </Stack>
      </Stack>
    </Paper>
  );
}
