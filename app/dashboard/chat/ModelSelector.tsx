"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Box,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  Typography,
} from "@mui/material";
import KeyboardArrowDownRoundedIcon from "@mui/icons-material/KeyboardArrowDownRounded";
import { dashboardCanvasTokens, dashboardTokens } from "@/app/theme";
import {
  DEFAULT_MODEL,
  MODEL_CATALOG,
  MODEL_NAMES,
  type ModelCapability,
  type ModelName,
} from "@/lib/ai/models";

interface ModelCapabilitiesResponse {
  success: boolean;
  data?: { models: ModelCapability[] };
}

interface ModelSelectorProps {
  model?: ModelName | undefined;
  onModelChange?: (model: ModelName | undefined) => void;
  disabled?: boolean;
  tone?: "dark" | "light";
}

export function ModelSelector({
  model,
  onModelChange,
  disabled = false,
  tone = "dark",
}: ModelSelectorProps) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [capabilities, setCapabilities] = useState<ModelCapability[] | null>(null);

  useEffect(() => {
    if (typeof fetch !== "function") {
      return;
    }

    let active = true;

    void fetch("/api/ai/models")
      .then(async (response) => {
        const payload = (await response.json()) as ModelCapabilitiesResponse;
        if (!response.ok || !payload.success) return;
        if (active) setCapabilities(payload.data?.models ?? []);
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, []);

  const capabilitiesById = useMemo(
    () => new Map(capabilities?.map((capability) => [capability.id, capability])),
    [capabilities],
  );

  if (!onModelChange) {
    return null;
  }

  const selectorTokens = tone === "light" ? dashboardCanvasTokens : dashboardTokens;

  const activeLabel = MODEL_CATALOG[model ?? DEFAULT_MODEL].label;
  const activeCaption = model
    ? capabilitiesById.get(model)?.available === false
      ? "Configuration required"
      : MODEL_CATALOG[model].summary
    : capabilitiesById.get(DEFAULT_MODEL)?.available === false
      ? "Default model · Configuration required"
      : "Default model";

  const choose = (next: ModelName | undefined) => {
    onModelChange(next);
    setAnchor(null);
  };

  return (
    <>
      <Box
        component="button"
        type="button"
        aria-label={`Model: ${activeLabel}`}
        disabled={disabled}
        onClick={(event: React.MouseEvent<HTMLButtonElement>) =>
          setAnchor(event.currentTarget)
        }
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 0.75,
          px: 1,
          py: 0.5,
          border: "1px solid",
          borderColor: selectorTokens.border,
          borderRadius: `${dashboardTokens.radiusSm}px`,
          bgcolor: tone === "light" ? selectorTokens.surface : "transparent",
          cursor: disabled ? "default" : "pointer",
          font: "inherit",
          textAlign: "left",
          minWidth: 0,
          "&:hover": {
            bgcolor: disabled ? "transparent" : selectorTokens.surfaceAlt,
          },
          "&:disabled": { opacity: 0.6 },
        }}
      >
        <Stack spacing={0} sx={{ minWidth: 0 }}>
          <Typography
            variant="body2"
            sx={{
              color: selectorTokens.text,
              fontWeight: 600,
              lineHeight: 1.2,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {activeLabel}
          </Typography>
          <Typography
            variant="caption"
            sx={{
              color: selectorTokens.textMuted,
              lineHeight: 1.2,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {activeCaption}
          </Typography>
        </Stack>
        <KeyboardArrowDownRoundedIcon
          fontSize="small"
          sx={{ color: selectorTokens.textMuted, flexShrink: 0 }}
        />
      </Box>

      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
        slotProps={{
          paper: {
            sx: {
              bgcolor: selectorTokens.surface,
              color: selectorTokens.text,
              border: "1px solid",
              borderColor: selectorTokens.border,
              borderRadius: `${dashboardTokens.radiusSm}px`,
              backgroundImage: "none",
              mt: 0.5,
              maxWidth: 320,
              "& .MuiMenuItem-root": {
                alignItems: "flex-start",
                py: 0.9,
                "&:hover": { bgcolor: selectorTokens.surfaceAlt },
                "&.Mui-selected": {
                  bgcolor: selectorTokens.surfaceAlt,
                  "&:hover": { bgcolor: selectorTokens.surfaceAlt },
                },
              },
            },
          },
        }}
      >
        <MenuItem
          selected={!model}
          disabled={capabilitiesById.get(DEFAULT_MODEL)?.available !== true}
          onClick={() => choose(undefined)}
        >
          <ListItemText
            primary="Default model"
            secondary={
              capabilitiesById.get(DEFAULT_MODEL)?.available === true
                ? `Uses ${MODEL_CATALOG[DEFAULT_MODEL].label}`
                : `${MODEL_CATALOG[DEFAULT_MODEL].label} · Configuration required`
            }
            slotProps={{
              primary: {
                fontSize: 14,
                fontWeight: 600,
                color: selectorTokens.text,
              },
              secondary: {
                fontSize: 12,
                color: selectorTokens.textMuted,
                sx: { whiteSpace: "normal" },
              },
            }}
          />
        </MenuItem>

        {MODEL_NAMES.map((name) => {
          const spec = MODEL_CATALOG[name];
          const available = capabilitiesById.get(name)?.available === true;

          return (
            <MenuItem
              key={name}
              selected={model === name}
              disabled={!available}
              onClick={() => choose(name)}
            >
              <ListItemText
                primary={spec.label}
                secondary={available ? spec.summary : `${spec.summary} · Configuration required`}
                slotProps={{
                  primary: {
                    fontSize: 14,
                    fontWeight: 600,
                    color: selectorTokens.text,
                  },
                  secondary: {
                    fontSize: 12,
                    color: selectorTokens.textMuted,
                    sx: { whiteSpace: "normal" },
                  },
                }}
              />
            </MenuItem>
          );
        })}
      </Menu>
    </>
  );
}
