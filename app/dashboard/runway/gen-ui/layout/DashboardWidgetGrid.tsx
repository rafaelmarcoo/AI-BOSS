"use client";

import {
  Box,
  Chip,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import DragIndicatorRoundedIcon from "@mui/icons-material/DragIndicatorRounded";
import PushPinOutlinedIcon from "@mui/icons-material/PushPinOutlined";
import PushPinRoundedIcon from "@mui/icons-material/PushPinRounded";
import VisibilityOffOutlinedIcon from "@mui/icons-material/VisibilityOffOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import { dashboardTokens } from "@/app/theme";
import {
  GEN_UI_WIDGET_CATALOG,
  GEN_UI_WIDGET_SIZE_DIMENSIONS,
  GEN_UI_WIDGET_SIZES,
} from "@/lib/gen-ui/catalog";
import type {
  DashboardForecastHorizon,
  DashboardLayoutPayload,
  DashboardLayoutWidget,
  HydratedDashboardLayout,
} from "@/lib/gen-ui/dashboard-layout-types";
import type { GenUiPlan } from "@/lib/gen-ui/types";
import { GenUiWidgetRenderer } from "../GenUiWidgetRenderer";
import { WidgetFrame } from "../shared/WidgetFrame";
import type { AskChatbotMode } from "../types";

interface DashboardWidgetGridProps {
  plan?: GenUiPlan | null;
  payload?: DashboardLayoutPayload | null;
  hydration?: HydratedDashboardLayout | null;
  editing?: boolean;
  hydrating?: boolean;
  onPayloadChange?: (payload: DashboardLayoutPayload) => void;
  onAskChatbot: (text: string, mode?: AskChatbotMode) => void;
}

const PERIOD_LABELS = {
  current: "Current",
  month: "This month",
  quarter: "This quarter",
  year: "This year",
  three_months: "3 months",
  six_months: "6 months",
  twelve_months: "12 months",
  all_history: "All history",
  seven_days: "7 days",
  fourteen_days: "14 days",
  thirty_days: "30 days",
  sixty_days: "60 days",
  ninety_days: "90 days",
} as const;

const NON_CURRENCY_WIDGETS = new Set([
  "data_connections",
  "planning_checklist",
  "risk_threshold_timeline",
  "metric_source_evidence",
  "missing_data_panel",
  "highlight_explainer",
]);

function horizonOptions(widgetType: DashboardLayoutWidget["widgetType"]) {
  if (widgetType === "metric_forecast_chart") return [3, 6] as const;
  if (widgetType === "cash_flow_forecast") return [30, 60, 90] as const;
  if (widgetType === "revenue_forecast") return [3, 6] as const;
  if (widgetType === "budget_forecast") return [] as const;
  if (widgetType === "debt_repayment_timeline") return [3, 6, 12] as const;
  if (GEN_UI_WIDGET_CATALOG[widgetType].requiresForecast) {
    return [3, 6, 12] as const;
  }
  return [] as const;
}

function sortedWidgets(widgets: DashboardLayoutWidget[]) {
  return widgets
    .map((widget, index) => ({ widget, index }))
    .sort((left, right) => {
      if (left.widget.isPinned === right.widget.isPinned) {
        return left.index - right.index;
      }
      return left.widget.isPinned ? -1 : 1;
    })
    .map(({ widget }) => widget);
}

export function DashboardWidgetGrid({
  plan,
  payload,
  hydration,
  editing = false,
  hydrating = false,
  onPayloadChange,
  onAskChatbot,
}: DashboardWidgetGridProps) {
  const generatedWidgets = plan?.widgets ?? [];
  const manualWidgets = payload ? sortedWidgets(payload.widgets) : [];
  const visibleManualWidgets = editing
    ? manualWidgets
    : manualWidgets.filter((item) => !item.isHidden);
  const rendered = new Map(
    (hydration?.items ?? []).map((item) => [item.itemId, item]),
  );

  const updateWidget = (
    id: string,
    update: (widget: DashboardLayoutWidget) => DashboardLayoutWidget,
  ) => {
    if (!payload || !onPayloadChange) return;
    onPayloadChange({
      ...payload,
      widgets: payload.widgets.map((widget) =>
        widget.id === id ? update(widget) : widget,
      ),
    });
  };

  const removeWidget = (id: string) => {
    if (!payload || !onPayloadChange) return;
    onPayloadChange({
      ...payload,
      widgets: payload.widgets.filter((widget) => widget.id !== id),
    });
  };

  const reorder = (sourceId: string, targetId: string) => {
    if (!payload || !onPayloadChange || sourceId === targetId) return;
    const widgets = [...payload.widgets];
    const sourceIndex = widgets.findIndex((widget) => widget.id === sourceId);
    const targetIndex = widgets.findIndex((widget) => widget.id === targetId);
    if (sourceIndex < 0 || targetIndex < 0) return;
    const [source] = widgets.splice(sourceIndex, 1);
    widgets.splice(targetIndex, 0, source);
    onPayloadChange({ ...payload, widgets });
  };

  const items = payload
    ? visibleManualWidgets.map((item) => ({
        key: item.id,
        item,
        widget: rendered.get(item.id)?.widget ?? null,
        error: rendered.get(item.id)?.error ?? null,
      }))
    : generatedWidgets.map((widget) => ({
        key: widget.id,
        item: null,
        widget,
        error: null,
      }));

  if (items.length === 0) {
    return (
      <Box sx={{ py: 5, borderTop: "1px solid", borderColor: dashboardTokens.border }}>
        <Typography sx={{ color: dashboardTokens.textMuted }}>
          {payload
            ? "This layout has no visible widgets. Add or unhide a widget to continue."
            : "Ask AI Boss a financial question to generate relevant widgets."}
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        py: 3,
        borderTop: "1px solid",
        borderColor: dashboardTokens.border,
        display: "grid",
        gridTemplateColumns: { xs: "1fr", xl: "repeat(2, minmax(0, 1fr))" },
        gridAutoRows: { xs: "auto", xl: "minmax(240px, auto)" },
        gap: 2,
      }}
    >
      {items.map(({ key, item, widget, error }) => {
        const size = item?.size ?? GEN_UI_WIDGET_CATALOG[widget!.type].defaultSize;
        const dimensions = GEN_UI_WIDGET_SIZE_DIMENSIONS[size];
        const catalog = item ? GEN_UI_WIDGET_CATALOG[item.widgetType] : null;
        const horizons = item ? horizonOptions(item.widgetType) : [];

        return (
          <Box
            key={key}
            draggable={Boolean(editing && item)}
            onDragStart={(event) => event.dataTransfer.setData("text/dashboard-widget", key)}
            onDragOver={(event) => {
              if (editing && item) event.preventDefault();
            }}
            onDrop={(event) => {
              if (!editing || !item) return;
              event.preventDefault();
              reorder(event.dataTransfer.getData("text/dashboard-widget"), item.id);
            }}
            data-widget-size={size}
            sx={{
              minWidth: 0,
              height: "100%",
              gridColumn: { xs: "span 1", xl: `span ${dimensions.columnSpan}` },
              gridRow: { xs: "auto", xl: `span ${dimensions.rowSpan}` },
              border: "1px solid",
              borderColor: dashboardTokens.border,
              borderRadius: "16px",
              overflow: "hidden",
              bgcolor: "rgba(255,255,255,0.025)",
              opacity: item?.isHidden ? 0.58 : 1,
              outline: editing ? `1px dashed ${dashboardTokens.borderSoft}` : "none",
              outlineOffset: -1,
            }}
          >
            {editing && item && catalog ? (
              <Stack
                spacing={1}
                sx={{
                  p: 1.25,
                  bgcolor: "rgba(255,255,255,0.025)",
                  borderBottom: "1px solid",
                  borderColor: dashboardTokens.border,
                }}
              >
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <DragIndicatorRoundedIcon
                    fontSize="small"
                    sx={{ color: dashboardTokens.textMuted, cursor: "grab" }}
                  />
                  <Typography variant="caption" fontWeight={700} sx={{ flex: 1 }}>
                    {catalog.label}
                  </Typography>
                  {item.isPinned ? <Chip label="Pinned" size="small" /> : null}
                  <Tooltip title={item.isPinned ? "Unpin widget" : "Pin widget"}>
                    <IconButton
                      size="small"
                      aria-label={item.isPinned ? "Unpin widget" : "Pin widget"}
                      onClick={() =>
                        updateWidget(item.id, (current) => ({
                          ...current,
                          isPinned: !current.isPinned,
                        }))
                      }
                    >
                      {item.isPinned ? (
                        <PushPinRoundedIcon fontSize="small" />
                      ) : (
                        <PushPinOutlinedIcon fontSize="small" />
                      )}
                    </IconButton>
                  </Tooltip>
                  <Tooltip title={item.isHidden ? "Show widget" : "Hide widget"}>
                    <IconButton
                      size="small"
                      aria-label={item.isHidden ? "Show widget" : "Hide widget"}
                      onClick={() =>
                        updateWidget(item.id, (current) => ({
                          ...current,
                          isHidden: !current.isHidden,
                        }))
                      }
                    >
                      {item.isHidden ? (
                        <VisibilityOffOutlinedIcon fontSize="small" />
                      ) : (
                        <VisibilityOutlinedIcon fontSize="small" />
                      )}
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Remove widget">
                    <IconButton
                      size="small"
                      aria-label="Remove widget"
                      onClick={() => removeWidget(item.id)}
                    >
                      <DeleteOutlineRoundedIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Stack>

                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  <FormControl size="small" sx={{ minWidth: 108 }}>
                    <InputLabel id={`size-${item.id}`}>Size</InputLabel>
                    <Select
                      labelId={`size-${item.id}`}
                      value={item.size}
                      label="Size"
                      onChange={(event) =>
                        updateWidget(item.id, (current) => ({
                          ...current,
                          size: event.target.value as DashboardLayoutWidget["size"],
                        }))
                      }
                    >
                      {GEN_UI_WIDGET_SIZES.map((value) => (
                        <MenuItem value={value} key={value}>{value}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  {catalog.supportedPeriods.length > 0 && horizons.length === 0 ? (
                    <FormControl size="small" sx={{ minWidth: 132 }}>
                      <InputLabel id={`period-${item.id}`}>Period</InputLabel>
                      <Select
                        labelId={`period-${item.id}`}
                        value={item.period ?? ""}
                        label="Period"
                        onChange={(event) =>
                          updateWidget(item.id, (current) => ({
                            ...current,
                            period: event.target.value as DashboardLayoutWidget["period"],
                          }))
                        }
                      >
                        {catalog.supportedPeriods.map((value) => (
                          <MenuItem value={value} key={value}>
                            {PERIOD_LABELS[value]}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  ) : null}

                  {horizons.length > 0 ? (
                    <FormControl size="small" sx={{ minWidth: 130 }}>
                      <InputLabel id={`horizon-${item.id}`}>Horizon</InputLabel>
                      <Select
                        labelId={`horizon-${item.id}`}
                        value={item.forecastHorizon ?? horizons[0]}
                        label="Horizon"
                        onChange={(event) =>
                          updateWidget(item.id, (current) => ({
                            ...current,
                            forecastHorizon: Number(event.target.value) as DashboardForecastHorizon,
                          }))
                        }
                      >
                        {horizons.map((value) => (
                          <MenuItem value={value} key={value}>
                            {value} {value >= 30 ? "days" : "months"}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  ) : null}

                  {!NON_CURRENCY_WIDGETS.has(item.widgetType) &&
                  (hydration?.availableCurrencies.length ?? 0) > 0 ? (
                    <FormControl size="small" sx={{ minWidth: 112 }}>
                      <InputLabel id={`currency-${item.id}`}>Currency</InputLabel>
                      <Select
                        labelId={`currency-${item.id}`}
                        value={item.currency ?? ""}
                        label="Currency"
                        onChange={(event) =>
                          updateWidget(item.id, (current) => ({
                            ...current,
                            currency: event.target.value || null,
                          }))
                        }
                      >
                        <MenuItem value="">Automatic</MenuItem>
                        {hydration?.availableCurrencies.map((value) => (
                          <MenuItem value={value} key={value}>{value}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  ) : null}
                </Stack>
              </Stack>
            ) : null}

            {item?.isHidden && editing ? (
              <Box sx={{ py: 4, px: 2 }}>
                <Typography variant="body2" sx={{ color: dashboardTokens.textMuted }}>
                  Hidden in the saved layout. Use the eye control to show it.
                </Typography>
              </Box>
            ) : widget ? (
              <GenUiWidgetRenderer widget={widget} onAskChatbot={onAskChatbot} />
            ) : (
              <WidgetFrame
                title={catalog?.label ?? "Widget unavailable"}
                reason="Saved layouts only display values rebuilt from trusted financial records."
              >
                <Typography variant="body2" sx={{ color: dashboardTokens.textMuted }}>
                  {hydrating ? "Refreshing current data…" : error ?? "Current data is unavailable for this widget."}
                </Typography>
              </WidgetFrame>
            )}
          </Box>
        );
      })}
    </Box>
  );
}
