"use client";

import { useState } from "react";
import { IconButton, Stack, TextField } from "@mui/material";
import SendRoundedIcon from "@mui/icons-material/SendRounded";
import { dashboardTokens } from "@/app/theme";

interface ChatInputProps {
  onSend: (value: string) => void;
  disabled?: boolean;
}

export function ChatInput({ onSend, disabled = false }: ChatInputProps) {
  const [value, setValue] = useState("");

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
  };

  return (
    <Stack direction="row" spacing={1.25} alignItems="center">
      <TextField
        fullWidth
        value={value}
        disabled={disabled}
        placeholder={
          disabled ? "AI-BOSS is replying..." : "Ask AI-BOSS something..."
        }
        variant="outlined"
        size="small"
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            submit();
          }
        }}
        sx={{
          "& .MuiOutlinedInput-root": {
            borderRadius: 999,
            bgcolor: dashboardTokens.surfaceAlt,
            color: "common.white",
          },
          "& .MuiOutlinedInput-notchedOutline": {
            borderColor: dashboardTokens.borderInput,
          },
          "& input": { color: "common.white" },
        }}
      />

      <IconButton
        color="primary"
        onClick={submit}
        disabled={disabled || !value.trim()}
        sx={{
          borderRadius: 999,
          width: 36,
          height: 36,
          bgcolor:
            disabled || !value.trim() ? dashboardTokens.surfaceAlt : "#2563eb",
          color: "common.white",
          "&:hover": {
            bgcolor:
              disabled || !value.trim()
                ? dashboardTokens.surfaceAlt
                : "#1d4ed8",
          },
          "&.Mui-disabled": {
            color: dashboardTokens.textMuted,
          },
        }}
      >
        <SendRoundedIcon fontSize="small" />
      </IconButton>
    </Stack>
  );
}
