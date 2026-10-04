"use client";

import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  FormControl,
  MenuItem,
  Select,
  Stack,
  Typography,
} from "@mui/material";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import ViewQuiltRoundedIcon from "@mui/icons-material/ViewQuiltRounded";
import { dashboardCanvasTokens as dashboardTokens } from "@/app/theme";
import {
  createDashboardLayoutWidget,
  dashboardPayloadFromPlan,
} from "@/lib/gen-ui/dashboard-layout-client";
import type {
  DashboardLayoutPayload,
  HydratedDashboardLayout,
  SavedDashboardLayout,
} from "@/lib/gen-ui/dashboard-layout-types";
import type { GenUiPlan, GenUiWidgetType } from "@/lib/gen-ui/types";
import type { AskChatbotMode } from "../types";
import { DashboardCustomizationPanel } from "./DashboardCustomizationPanel";
import { DashboardWidgetGrid } from "./DashboardWidgetGrid";

interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  error?: { message?: string };
}

interface DraftSource {
  planVersion: number | null;
  generatedAt: string | null;
}

export function DashboardLayoutWorkspace({
  plan,
  customizationEnabled,
  onAskChatbot,
}: {
  plan: GenUiPlan | null;
  customizationEnabled: boolean;
  onAskChatbot: (text: string, mode?: AskChatbotMode) => void;
}) {
  const [layouts, setLayouts] = useState<SavedDashboardLayout[]>([]);
  const [mode, setMode] = useState<"ai" | "manual">("ai");
  const [selectedLayoutId, setSelectedLayoutId] = useState<string | null>(null);
  const [payload, setPayload] = useState<DashboardLayoutPayload | null>(null);
  const [hydration, setHydration] = useState<HydratedDashboardLayout | null>(null);
  const [draftName, setDraftName] = useState("My dashboard");
  const [draftDefault, setDraftDefault] = useState(false);
  const [draftSource, setDraftSource] = useState<DraftSource>({
    planVersion: null,
    generatedAt: null,
  });
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hydrating, setHydrating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!customizationEnabled || typeof fetch !== "function") return;
    let cancelled = false;
    void fetch("/api/settings/dashboard-layouts", { cache: "no-store" })
      .then(async (response) => {
        const result = (await response.json()) as ApiEnvelope<{
          layouts?: SavedDashboardLayout[];
        }>;
        if (!response.ok || !result.success) {
          throw new Error(result.error?.message ?? "Could not load saved layouts.");
        }
        return Array.isArray(result.data?.layouts) ? result.data.layouts : [];
      })
      .then((savedLayouts) => {
        if (cancelled) return;
        setLayouts(savedLayouts);
        const defaultLayout = savedLayouts.find((layout) => layout.isDefault);
        if (defaultLayout) selectLayout(defaultLayout);
      })
      .catch((requestError) => {
        if (!cancelled) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Could not load saved layouts.",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [customizationEnabled]);

  useEffect(() => {
    if (mode !== "manual" || !payload || typeof fetch !== "function") return;
    if (payload.widgets.length === 0) {
      setHydration({ items: [], availableCurrencies: [] });
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      setHydrating(true);
      void fetch("/api/settings/dashboard-layouts/hydrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload }),
        signal: controller.signal,
      })
        .then(async (response) => {
          const result = (await response.json()) as ApiEnvelope<{
            hydration?: HydratedDashboardLayout;
          }>;
          if (!response.ok || !result.success || !result.data?.hydration) {
            throw new Error(
              result.error?.message ?? "Could not refresh this dashboard layout.",
            );
          }
          setHydration(result.data.hydration);
        })
        .catch((requestError) => {
          if (requestError instanceof DOMException && requestError.name === "AbortError") {
            return;
          }
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Could not refresh this dashboard layout.",
          );
        })
        .finally(() => setHydrating(false));
    }, 250);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [mode, payload]);

  const selectLayout = (layout: SavedDashboardLayout) => {
    setMode("manual");
    setSelectedLayoutId(layout.id);
    setPayload(layout.payload);
    setDraftName(layout.name);
    setDraftDefault(layout.isDefault);
    setDraftSource({
      planVersion: layout.sourcePlanVersion,
      generatedAt: layout.sourceGeneratedAt,
    });
    setEditing(false);
    setError(null);
    setNotice(null);
  };

  const showAiLayout = () => {
    setMode("ai");
    setSelectedLayoutId(null);
    setPayload(null);
    setHydration(null);
    setEditing(false);
    setError(null);
    setNotice(null);
  };

  const customizeAiLayout = () => {
    setMode("manual");
    setSelectedLayoutId(null);
    setPayload(dashboardPayloadFromPlan(plan));
    setDraftName("My dashboard");
    setDraftDefault(layouts.length === 0);
    setDraftSource({
      planVersion: plan?.version ?? null,
      generatedAt: plan?.generatedAt ?? null,
    });
    setEditing(true);
    setError(null);
    setNotice(null);
  };

  const resetToAi = () => {
    if (!payload) return;
    setPayload(dashboardPayloadFromPlan(plan, payload.riskThresholds));
    setDraftSource({
      planVersion: plan?.version ?? null,
      generatedAt: plan?.generatedAt ?? null,
    });
    setNotice("Draft reset to the current AI-generated layout. Save to keep it.");
  };

  const cancelEditing = () => {
    const saved = layouts.find((layout) => layout.id === selectedLayoutId);
    if (saved) selectLayout(saved);
    else showAiLayout();
  };

  const saveLayout = async () => {
    if (!payload) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(
        selectedLayoutId
          ? `/api/settings/dashboard-layouts/${selectedLayoutId}`
          : "/api/settings/dashboard-layouts",
        {
          method: selectedLayoutId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: draftName,
            isDefault: draftDefault,
            sourcePlanVersion: draftSource.planVersion,
            sourceGeneratedAt: draftSource.generatedAt,
            payload,
          }),
        },
      );
      const result = (await response.json()) as ApiEnvelope<{
        layout?: SavedDashboardLayout;
      }>;
      if (!response.ok || !result.success || !result.data?.layout) {
        throw new Error(result.error?.message ?? "Could not save the layout.");
      }
      const saved = result.data.layout;
      setLayouts((current) => [
        saved,
        ...current
          .filter((layout) => layout.id !== saved.id)
          .map((layout) =>
            saved.isDefault ? { ...layout, isDefault: false } : layout,
          ),
      ]);
      selectLayout(saved);
      setNotice("Layout saved. New AI answers will not overwrite it.");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not save the layout.",
      );
    } finally {
      setSaving(false);
    }
  };

  const deleteLayout = async () => {
    if (!selectedLayoutId) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/settings/dashboard-layouts/${selectedLayoutId}`,
        { method: "DELETE" },
      );
      const result = (await response.json()) as ApiEnvelope<{ deleted: boolean }>;
      if (!response.ok || !result.success) {
        throw new Error(result.error?.message ?? "Could not delete the layout.");
      }
      setLayouts((current) =>
        current.filter((layout) => layout.id !== selectedLayoutId),
      );
      showAiLayout();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not delete the layout.",
      );
    } finally {
      setSaving(false);
    }
  };

  const addWidget = (widgetType: GenUiWidgetType) => {
    if (!payload || payload.widgets.length >= 20) {
      setError("A saved layout can contain up to 20 widgets.");
      return;
    }
    setPayload({
      ...payload,
      widgets: [...payload.widgets, createDashboardLayoutWidget(widgetType)],
    });
  };

  return (
    <Box>
      {customizationEnabled ? (
        <Stack
          spacing={1.25}
          sx={{
            mb: 1,
            p: 1.25,
            border: "1px solid",
            borderColor: dashboardTokens.border,
            borderRadius: "12px",
            bgcolor: dashboardTokens.surface,
            boxShadow: "0 5px 16px rgba(32, 58, 80, 0.06)",
          }}
        >
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1}
            alignItems={{ xs: "stretch", sm: "center" }}
            justifyContent="space-between"
          >
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
              <FormControl size="small" sx={{ minWidth: 190 }}>
                <Select
                  aria-label="Dashboard layout"
                  value={mode === "ai" ? "__ai__" : selectedLayoutId ?? "__draft__"}
                  onChange={(event) => {
                    if (event.target.value === "__ai__") showAiLayout();
                    else {
                      const saved = layouts.find(
                        (layout) => layout.id === event.target.value,
                      );
                      if (saved) selectLayout(saved);
                    }
                  }}
                >
                  <MenuItem value="__ai__">AI-generated layout</MenuItem>
                  {mode === "manual" && !selectedLayoutId ? (
                    <MenuItem value="__draft__">Unsaved layout</MenuItem>
                  ) : null}
                  {layouts.map((layout) => (
                    <MenuItem value={layout.id} key={layout.id}>
                      {layout.name}{layout.isDefault ? " · default" : ""}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Chip
                size="small"
                icon={mode === "ai" ? <AutoAwesomeRoundedIcon /> : <ViewQuiltRoundedIcon />}
                label={mode === "ai" ? "AI plan" : "Saved layout"}
                sx={{ color: mode === "ai" ? "#2B6A9B" : "#6C58A6" }}
              />
              {hydrating ? (
                <Typography variant="caption" sx={{ color: dashboardTokens.textMuted }}>
                  Refreshing trusted data…
                </Typography>
              ) : null}
            </Stack>
            {mode === "manual" && selectedLayoutId ? (
              <Button
                variant="outlined"
                startIcon={<EditRoundedIcon />}
                onClick={() => setEditing((current) => !current)}
              >
                {editing ? "Close editor" : "Edit layout"}
              </Button>
            ) : mode === "ai" ? (
              <Button
                variant="outlined"
                startIcon={<EditRoundedIcon />}
                onClick={customizeAiLayout}
              >
                {plan?.widgets.length ? "Customize this layout" : "Create layout"}
              </Button>
            ) : null}
          </Stack>

          {error ? <Alert severity="error" onClose={() => setError(null)}>{error}</Alert> : null}
          {notice ? <Alert severity="success" onClose={() => setNotice(null)}>{notice}</Alert> : null}
        </Stack>
      ) : null}

      {mode === "manual" && payload && editing ? (
        <DashboardCustomizationPanel
          name={draftName}
          isDefault={draftDefault}
          payload={payload}
          saving={saving}
          hasAiPlan={Boolean(plan?.widgets.length)}
          canDelete={selectedLayoutId !== null}
          onNameChange={setDraftName}
          onDefaultChange={setDraftDefault}
          onRiskThresholdsChange={(riskThresholds) =>
            setPayload((current) =>
              current ? { ...current, riskThresholds } : current,
            )
          }
          onAddWidget={addWidget}
          onResetToAi={resetToAi}
          onSave={saveLayout}
          onCancel={cancelEditing}
          onDelete={deleteLayout}
        />
      ) : null}

      <DashboardWidgetGrid
        plan={mode === "ai" ? plan : null}
        payload={mode === "manual" ? payload : null}
        hydration={hydration}
        editing={mode === "manual" && editing}
        hydrating={hydrating}
        onPayloadChange={setPayload}
        onAskChatbot={onAskChatbot}
      />
    </Box>
  );
}
