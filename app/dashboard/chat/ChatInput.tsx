"use client";

import { useRef, useState } from "react";
import { IconButton, Stack, TextField } from "@mui/material";
import SendRoundedIcon from "@mui/icons-material/SendRounded";
import UploadFileRoundedIcon from "@mui/icons-material/UploadFileRounded";
import { dashboardTokens } from "@/app/theme";

interface ChatInputProps {
  onSend: (value: string) => void;
  onUploadDocument: (file: File) => Promise<void>;
  disabled?: boolean;
  uploadDisabled?: boolean;
}

export function ChatInput({
  onSend,
  onUploadDocument,
  disabled = false,
  uploadDisabled = false,
}: ChatInputProps) {
  const [value, setValue] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
  };

  const handleChooseFile = () => {
    if (uploadDisabled) {
      return;
    }

    fileInputRef.current?.click();
  };

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    await onUploadDocument(file);
    event.target.value = "";
  };

  return (
    <Stack direction="row" spacing={1.25} alignItems="center">
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.csv,application/pdf,text/csv"
        hidden
        onChange={(event) => void handleFileChange(event)}
      />

      <IconButton
        onClick={handleChooseFile}
        disabled={uploadDisabled}
        sx={{
          borderRadius: 999,
          width: 36,
          height: 36,
          border: "1px solid",
          borderColor: dashboardTokens.borderInput,
          bgcolor: dashboardTokens.surfaceAlt,
          color: "common.white",
          "&:hover": {
            bgcolor: "rgba(255,255,255,0.08)",
          },
          "&.Mui-disabled": {
            color: dashboardTokens.textMuted,
          },
        }}
      >
        <UploadFileRoundedIcon fontSize="small" />
      </IconButton>

      <TextField
        fullWidth
        value={value}
        disabled={disabled}
        placeholder={
          disabled ? "AI-BOSS is replying..." : "Ask AI-BOSS something..."
        }
        variant="outlined"
        size="small"
        onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
          setValue(event.target.value)
        }
        onKeyDown={(event: React.KeyboardEvent<HTMLInputElement>) => {
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
