"use client";

import { useMemo, useState } from "react";
import {
  Box,
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
import { dashboardTokens } from "@/app/theme";
import { GEN_UI_WIDGET_CATALOG_ENTRIES } from "@/lib/gen-ui/catalog";
import type {
  DashboardLayoutPayload,
  DashboardRiskThresholds,
} from "@/lib/gen-ui/dashboard-layout-types";
import type { GenUiWidgetType } from "@/lib/gen-ui/types";

const CONVERSATION_ONLY_WIDGETS = new Set<GenUiWidgetType>([
  "scenario_comparison",
  "scenario_analysis",
  "highlight_explainer",
]);

interface DashboardCustomizationPanelProps {
  name: string;
  isDefault: boolean;
  payload: DashboardLayoutPayload;
  saving: boolean;
  hasAiPlan: boolean;
  canDelete: boolean;
  onNameChange: (name: string) => void;
  onDefaultChange: (isDefault: boolean) => void;
  onRiskThresholdsChange: (thresholds: DashboardRiskThresholds) => void;
  onAddWidget: (widgetType: GenUiWidgetType) => void;
  onResetToAi: () => void;
  onSave: () => void;
  onCancel: () => void;
  onDelete: () => void;
}

export function DashboardCustomizationPanel({
  name,
  isDefault,
  payload,
  saving,
  hasAiPlan,
  canDelete,
  onNameChange,
  onDefaultChange,
  onRiskThresholdsChange,
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
  const threshold = (
    key: keyof DashboardRiskThresholds,
    value: string,
  ) => {
    const number = Number(value);
    if (!Number.isFinite(number)) return;
    onRiskThresholdsChange({
      ...payload.riskThresholds,
      [key]: number,
    });
  };

  return (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 2, sm: 2.5 },
        mb: 2,
        bgcolor: "rgba(255,255,255,0.025)",
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

        <Box>
          <Typography fontWeight={650} sx={{ mb: 0.4 }}>
            Risk thresholds
          </Typography>
          <Typography variant="body2" sx={{ color: dashboardTokens.textMuted, mb: 1.25 }}>
            These thresholds apply only to this layout&apos;s runway and customer-concentration risk widgets.
          </Typography>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", xl: "repeat(3, 1fr)" },
              gap: 1.25,
            }}
          >
            <ThresholdField label="Runway caution (months)" value={payload.riskThresholds.runwayCautionMonths} onChange={(value) => threshold("runwayCautionMonths", value)} />
            <ThresholdField label="Runway urgent (months)" value={payload.riskThresholds.runwayUrgentMonths} onChange={(value) => threshold("runwayUrgentMonths", value)} />
            <ThresholdField label="Top customer elevated (%)" value={payload.riskThresholds.customerTopOneElevatedPercent} onChange={(value) => threshold("customerTopOneElevatedPercent", value)} />
            <ThresholdField label="Top customer high (%)" value={payload.riskThresholds.customerTopOneHighPercent} onChange={(value) => threshold("customerTopOneHighPercent", value)} />
            <ThresholdField label="Top three elevated (%)" value={payload.riskThresholds.customerTopThreeElevatedPercent} onChange={(value) => threshold("customerTopThreeElevatedPercent", value)} />
            <ThresholdField label="Top three high (%)" value={payload.riskThresholds.customerTopThreeHighPercent} onChange={(value) => threshold("customerTopThreeHighPercent", value)} />
          </Box>
        </Box>

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

function ThresholdField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: string) => void;
}) {
  return (
    <TextField
      label={label}
      type="number"
      size="small"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      inputProps={{ min: 0, max: 100, step: 0.5 }}
    />
  );
}

