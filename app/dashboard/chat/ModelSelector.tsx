"use client";

import { useState } from "react";
import {
  Box,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  Typography,
} from "@mui/material";
import KeyboardArrowDownRoundedIcon from "@mui/icons-material/KeyboardArrowDownRounded";
import { dashboardTokens } from "@/app/theme";
import {
  DEFAULT_MODEL,
  MODEL_CATALOG,
  MODEL_NAMES,
  type ModelName,
} from "@/lib/ai/models";

interface ModelSelectorProps {
  model?: ModelName | undefined;
  onModelChange?: (model: ModelName | undefined) => void;
  disabled?: boolean;
}

export function ModelSelector({
  model,
  onModelChange,
  disabled = false,
}: ModelSelectorProps) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  if (!onModelChange) {
    return null;
  }

  const activeLabel = MODEL_CATALOG[model ?? DEFAULT_MODEL].label;
  const activeCaption = model
    ? MODEL_CATALOG[model].summary
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
          borderColor: dashboardTokens.border,
          borderRadius: `${dashboardTokens.radiusSm}px`,
          bgcolor: "transparent",
          cursor: disabled ? "default" : "pointer",
          font: "inherit",
          textAlign: "left",
          minWidth: 0,
          "&:hover": {
            bgcolor: disabled ? "transparent" : dashboardTokens.surfaceAlt,
          },
          "&:disabled": { opacity: 0.6 },
        }}
      >
        <Stack spacing={0} sx={{ minWidth: 0 }}>
          <Typography
            variant="body2"
            sx={{
              color: dashboardTokens.text,
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
              color: dashboardTokens.textMuted,
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
          sx={{ color: dashboardTokens.textMuted, flexShrink: 0 }}
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
              bgcolor: dashboardTokens.surface,
              color: dashboardTokens.text,
              border: "1px solid",
              borderColor: dashboardTokens.border,
              borderRadius: `${dashboardTokens.radiusSm}px`,
              backgroundImage: "none",
              mt: 0.5,
              maxWidth: 320,
              "& .MuiMenuItem-root": {
                alignItems: "flex-start",
                py: 0.9,
                "&:hover": { bgcolor: dashboardTokens.surfaceAlt },
                "&.Mui-selected": {
                  bgcolor: dashboardTokens.surfaceAlt,
                  "&:hover": { bgcolor: dashboardTokens.surfaceAlt },
                },
              },
            },
          },
        }}
      >
        <MenuItem selected={!model} onClick={() => choose(undefined)}>
          <ListItemText
            primary="Default model"
            secondary={`Uses ${MODEL_CATALOG[DEFAULT_MODEL].label}, or whatever each agent is configured with`}
            slotProps={{
              primary: {
                fontSize: 14,
                fontWeight: 600,
                color: dashboardTokens.text,
              },
              secondary: {
                fontSize: 12,
                color: dashboardTokens.textMuted,
                sx: { whiteSpace: "normal" },
              },
            }}
          />
        </MenuItem>

        {MODEL_NAMES.map((name) => {
          const spec = MODEL_CATALOG[name];

          return (
            <MenuItem
              key={name}
              selected={model === name}
              onClick={() => choose(name)}
            >
              <ListItemText
                primary={spec.label}
                secondary={spec.summary}
                slotProps={{
                  primary: {
                    fontSize: 14,
                    fontWeight: 600,
                    color: dashboardTokens.text,
                  },
                  secondary: {
                    fontSize: 12,
                    color: dashboardTokens.textMuted,
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
