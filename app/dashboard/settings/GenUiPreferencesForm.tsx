"use client";

import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import BusinessRoundedIcon from "@mui/icons-material/BusinessRounded";
import {
  BUSINESS_SIZE_LABELS,
  BUSINESS_SIZES,
  ADMIN_GEN_UI_DECISION_ROLES,
  DECISION_ROLE_LABELS,
  DETAIL_LEVEL_LABELS,
  GEN_UI_DETAIL_LEVELS,
  GEN_UI_PLANNING_HORIZONS,
  GEN_UI_PRIORITY_TOPICS,
  PRIORITY_TOPIC_LABELS,
  WORKER_GEN_UI_DECISION_ROLES,
  type BusinessSize,
  type GenUiDecisionRole,
  type GenUiDetailLevel,
  type GenUiPersonalization,
  type GenUiPlanningHorizon,
  type GenUiPriorityTopic,
} from "@/lib/gen-ui/preferences-types";
import { dashboardTokens } from "@/app/theme";

interface PreferencesApiResponse {
  success: boolean;
  data?: { preferences: GenUiPersonalization };
  error?: { message?: string };
}

export function GenUiPreferencesForm({
  initialPreferences,
}: {
  initialPreferences: GenUiPersonalization;
}) {
  const [preferences, setPreferences] = useState(initialPreferences);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const isCompanyAdmin = preferences.canEditBusinessSize;
  const availableRoles = isCompanyAdmin
    ? ADMIN_GEN_UI_DECISION_ROLES
    : WORKER_GEN_UI_DECISION_ROLES;

  const update = <Key extends keyof GenUiPersonalization>(
    key: Key,
    value: GenUiPersonalization[Key]
  ) => setPreferences((current) => ({ ...current, [key]: value }));

  const togglePriority = (topic: GenUiPriorityTopic) => {
    const isSelected = preferences.priorityTopics.includes(topic);
    if (!isSelected && preferences.priorityTopics.length >= 3) {
      setError("Choose up to three focus areas.");
      return;
    }

    setError(null);
    update(
      "priorityTopics",
      isSelected
        ? preferences.priorityTopics.filter((item) => item !== topic)
        : [...preferences.priorityTopics, topic]
    );
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/settings/gen-ui", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessSize: preferences.businessSize,
          decisionRole: preferences.decisionRole,
          priorityTopics: preferences.priorityTopics,
          detailLevel: preferences.detailLevel,
          planningHorizon: preferences.planningHorizon,
          learnFromHistory: preferences.learnFromHistory,
        }),
      });
      const payload = (await response.json()) as PreferencesApiResponse;

      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(
          payload.error?.message ?? "Could not save your personalization settings."
        );
      }

      setPreferences(payload.data.preferences);
      setSuccess("Personalization saved. New Gen UI answers will use these preferences.");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not save your personalization settings."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 2, sm: 3 },
        bgcolor: "rgba(255,255,255,0.03)",
        border: "1px solid",
        borderColor: dashboardTokens.border,
      }}
    >
      <Stack spacing={3}>
        <Stack direction="row" spacing={1.25} alignItems="flex-start">
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: 2,
              display: "grid",
              placeItems: "center",
              bgcolor: "rgba(79,125,243,0.16)",
              color: "#AFC6FF",
              flexShrink: 0,
            }}
          >
            <AutoAwesomeRoundedIcon fontSize="small" />
          </Box>
          <Stack spacing={0.4}>
            <Typography variant="h6" fontWeight={700}>
              Personalise AI Boss
            </Typography>
            <Typography variant="body2" sx={{ color: dashboardTokens.textMuted }}>
              Help AI Boss choose the most useful widgets and the right amount of detail for you.
              Your current question will always take priority.
            </Typography>
          </Stack>
        </Stack>

        {error ? <Alert severity="error">{error}</Alert> : null}
        {success ? <Alert severity="success">{success}</Alert> : null}

        {isCompanyAdmin ? (
          <PreferenceSection
            icon={<BusinessRoundedIcon fontSize="small" />}
            title="Company profile"
            description="Shared across your company so recommendations match its size and planning cycle."
          >
            <ToggleButtonGroup
              exclusive
              value={preferences.businessSize}
              onChange={(_, value: BusinessSize | null) => {
                if (value) update("businessSize", value);
              }}
              disabled={saving}
              aria-label="Business size"
              sx={toggleGroupStyles}
            >
              {BUSINESS_SIZES.map((size) => (
                <ToggleButton key={size} value={size}>
                  {BUSINESS_SIZE_LABELS[size]}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </PreferenceSection>
        ) : null}

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr",
              md: isCompanyAdmin ? "1fr 1fr" : "1fr",
            },
            gap: 2,
          }}
        >
          <FormControl fullWidth>
            <InputLabel id="decision-role-label">Your decision role</InputLabel>
            <Select
              labelId="decision-role-label"
              value={preferences.decisionRole}
              label="Your decision role"
              disabled={saving}
              onChange={(event) =>
                update("decisionRole", event.target.value as GenUiDecisionRole)
              }
            >
              {availableRoles.map((role) => (
                <MenuItem key={role} value={role}>
                  {DECISION_ROLE_LABELS[role]}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {isCompanyAdmin ? (
            <FormControl fullWidth>
              <InputLabel id="planning-horizon-label">Company planning horizon</InputLabel>
              <Select
                labelId="planning-horizon-label"
                value={preferences.planningHorizon}
                label="Company planning horizon"
                disabled={saving}
                onChange={(event) =>
                  update(
                    "planningHorizon",
                    Number(event.target.value) as GenUiPlanningHorizon
                  )
                }
              >
                {GEN_UI_PLANNING_HORIZONS.map((horizon) => (
                  <MenuItem key={horizon} value={horizon}>
                    {horizon} months
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          ) : null}
        </Box>

        <PreferenceSection
          title="Focus areas"
          description="Choose up to three. These guide relevance when several widgets could answer the question."
        >
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {GEN_UI_PRIORITY_TOPICS.map((topic) => {
              const selected = preferences.priorityTopics.includes(topic);
              return (
                <Chip
                  key={topic}
                  clickable
                  disabled={saving}
                  label={PRIORITY_TOPIC_LABELS[topic]}
                  onClick={() => togglePriority(topic)}
                  variant={selected ? "filled" : "outlined"}
                  sx={{
                    color: selected ? "#EAF0FF" : dashboardTokens.textSoft,
                    bgcolor: selected ? "rgba(79,125,243,0.24)" : "transparent",
                    borderColor: selected ? "rgba(111,149,247,0.7)" : dashboardTokens.borderSoft,
                    "&:hover": {
                      bgcolor: selected
                        ? "rgba(79,125,243,0.32)"
                        : "rgba(255,255,255,0.06)",
                    },
                  }}
                />
              );
            })}
          </Stack>
        </PreferenceSection>

        <PreferenceSection
          title="Answer detail"
          description="Controls the usual density of Gen UI. AI Boss can still use fewer widgets when that is clearer."
        >
          <ToggleButtonGroup
            exclusive
            value={preferences.detailLevel}
            onChange={(_, value: GenUiDetailLevel | null) => {
              if (value) update("detailLevel", value);
            }}
            disabled={saving}
            aria-label="Answer detail"
            sx={toggleGroupStyles}
          >
            {GEN_UI_DETAIL_LEVELS.map((level) => (
              <ToggleButton key={level} value={level}>
                {DETAIL_LEVEL_LABELS[level]}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </PreferenceSection>

        {isCompanyAdmin ? (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 2,
              p: 2,
              borderRadius: 2,
              border: "1px solid",
              borderColor: dashboardTokens.border,
              bgcolor: "rgba(255,255,255,0.02)",
            }}
          >
            <Stack spacing={0.35}>
              <Typography fontWeight={650}>Learn from my recent questions</Typography>
              <Typography variant="body2" sx={{ color: dashboardTokens.textMuted }}>
                Next checkpoint: use only your own chat themes to improve focus-area suggestions.
              </Typography>
            </Stack>
            <Switch
              checked={preferences.learnFromHistory}
              disabled
              inputProps={{ "aria-label": "Learn from my recent questions" }}
            />
          </Box>
        ) : null}

        <Button
          variant="contained"
          onClick={save}
          disabled={
            saving ||
            (preferences.canEditBusinessSize && preferences.businessSize === null)
          }
          sx={{ alignSelf: "flex-start", px: 2.5 }}
        >
          {saving ? "Saving…" : "Save personalization"}
        </Button>
        {preferences.canEditBusinessSize && preferences.businessSize === null ? (
          <Typography variant="caption" sx={{ color: dashboardTokens.warning }}>
            Choose a business size before saving.
          </Typography>
        ) : null}
      </Stack>
    </Paper>
  );
}

function PreferenceSection({
  icon,
  title,
  description,
  children,
}: {
  icon?: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Stack spacing={1.25}>
      <Stack direction="row" spacing={0.75} alignItems="center">
        {icon ? <Box sx={{ color: dashboardTokens.textMuted, display: "flex" }}>{icon}</Box> : null}
        <Typography fontWeight={650}>{title}</Typography>
      </Stack>
      <Typography variant="body2" sx={{ color: dashboardTokens.textMuted, mt: "-6px !important" }}>
        {description}
      </Typography>
      {children}
    </Stack>
  );
}

const toggleGroupStyles = {
  alignSelf: "flex-start",
  flexWrap: "wrap",
  gap: 1,
  "& .MuiToggleButtonGroup-grouped": {
    border: `1px solid ${dashboardTokens.borderSoft} !important`,
    borderRadius: "8px !important",
    color: dashboardTokens.textSoft,
    px: 1.75,
    py: 0.9,
    textTransform: "none",
    fontWeight: 600,
    "&.Mui-selected": {
      color: "#EAF0FF",
      bgcolor: "rgba(79,125,243,0.24)",
      borderColor: "rgba(111,149,247,0.7) !important",
    },
  },
};
