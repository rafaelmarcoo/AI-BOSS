"use client";

import { useRef, useState } from "react";
import {
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
} from "@mui/material";
import SendRoundedIcon from "@mui/icons-material/SendRounded";
import AttachFileRoundedIcon from "@mui/icons-material/AttachFileRounded";
import PublicRoundedIcon from "@mui/icons-material/PublicRounded";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import AdminPanelSettingsRoundedIcon from "@mui/icons-material/AdminPanelSettingsRounded";
import { dashboardTokens } from "@/app/theme";
import { VoiceInputButton } from "@/components/voice-input-button";
import type { ConversationVisibility, UserType } from "@/types/database";

interface ChatInputProps {
  onSend: (value: string) => void;
  onUploadDocument: (file: File) => Promise<void>;
  disabled?: boolean;
  uploadDisabled?: boolean;
  userType?: UserType | null;
  visibility?: ConversationVisibility;
  visibilityDisabled?: boolean;
  onVisibilityChange?: (visibility: ConversationVisibility) => void;
}

export function ChatInput({
  onSend,
  onUploadDocument,
  disabled = false,
  uploadDisabled = false,
  userType = null,
  visibility = "company",
  visibilityDisabled = false,
  onVisibilityChange,
}: ChatInputProps) {
  const [value, setValue] = useState("");
  const [visibilityAnchor, setVisibilityAnchor] =
    useState<HTMLElement | null>(null);
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

  const visibilityLabel =
    visibility === "private"
      ? "Private"
      : visibility === "admins"
        ? "Admins only"
        : "Company";

  const chooseVisibility = (nextVisibility: ConversationVisibility) => {
    onVisibilityChange?.(nextVisibility);
    setVisibilityAnchor(null);
  };

  return (
    <Stack direction="row" spacing={0.75} alignItems="center">
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.csv,application/pdf,text/csv"
        hidden
        onChange={(event) => void handleFileChange(event)}
      />

      <IconButton
        aria-label="Upload document"
        onClick={handleChooseFile}
        disabled={uploadDisabled}
        sx={{
          borderRadius: `${dashboardTokens.radiusSm}px`,
          width: 32,
          height: 32,
          bgcolor: "transparent",
          color: dashboardTokens.textMuted,
          "&:hover": {
            bgcolor: dashboardTokens.surfaceAlt,
            color: dashboardTokens.text,
          },
          "&.Mui-disabled": {
            color: dashboardTokens.textMuted,
          },
        }}
      >
        <AttachFileRoundedIcon fontSize="small" />
      </IconButton>

      <VoiceInputButton
        disabled={disabled}
        onTranscript={(transcript) =>
          setValue((current) =>
            [current.trimEnd(), transcript.trim()].filter(Boolean).join(" "),
          )
        }
      />

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
            minHeight: 38,
            borderRadius: `${dashboardTokens.radiusSm}px`,
            bgcolor: dashboardTokens.surface,
            color: dashboardTokens.text,
            fontSize: 14,
          },
          "& .MuiOutlinedInput-notchedOutline": {
            borderColor: dashboardTokens.borderInput,
          },
          "& input": { color: "common.white" },
        }}
      />

      <Tooltip
        title={
          visibilityDisabled
            ? `${visibilityLabel} visibility is fixed for this conversation`
            : `Chat visibility: ${visibilityLabel}`
        }
      >
        <span>
          <IconButton
            aria-label={`Chat visibility: ${visibilityLabel}`}
            onClick={(event) => setVisibilityAnchor(event.currentTarget)}
            disabled={disabled || visibilityDisabled}
            sx={{
              borderRadius: `${dashboardTokens.radiusSm}px`,
              width: 32,
              height: 32,
              bgcolor: "transparent",
              color: dashboardTokens.textMuted,
              "&:hover": { bgcolor: dashboardTokens.surfaceAlt, color: dashboardTokens.text },
              "&.Mui-disabled": { color: dashboardTokens.textMuted },
            }}
          >
            {visibility === "private" ? (
              <LockRoundedIcon fontSize="small" />
            ) : visibility === "admins" ? (
              <AdminPanelSettingsRoundedIcon fontSize="small" />
            ) : (
              <PublicRoundedIcon fontSize="small" />
            )}
          </IconButton>
        </span>
      </Tooltip>

      <Menu
        anchorEl={visibilityAnchor}
        open={Boolean(visibilityAnchor)}
        onClose={() => setVisibilityAnchor(null)}
      >
        <MenuItem
          selected={visibility === "private"}
          onClick={() => chooseVisibility("private")}
        >
          <ListItemIcon><LockRoundedIcon fontSize="small" /></ListItemIcon>
          <ListItemText primary="Private" secondary="Only you" />
        </MenuItem>
        <MenuItem
          selected={visibility === "company"}
          onClick={() => chooseVisibility("company")}
        >
          <ListItemIcon><PublicRoundedIcon fontSize="small" /></ListItemIcon>
          <ListItemText primary="Company" secondary="Everyone in your company" />
        </MenuItem>
        {userType === "admin" ? (
          <MenuItem
            selected={visibility === "admins"}
            onClick={() => chooseVisibility("admins")}
          >
            <ListItemIcon>
              <AdminPanelSettingsRoundedIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Admins only" secondary="Company admins" />
          </MenuItem>
        ) : null}
      </Menu>

      <IconButton
        aria-label="Send message"
        color="primary"
        onClick={submit}
        disabled={disabled || !value.trim()}
        sx={{
          borderRadius: `${dashboardTokens.radiusSm}px`,
          width: 32,
          height: 32,
          bgcolor:
            disabled || !value.trim() ? dashboardTokens.surfaceAlt : dashboardTokens.accent,
          color: dashboardTokens.text,
          "&:hover": {
            bgcolor:
              disabled || !value.trim()
                ? dashboardTokens.surfaceAlt
                : dashboardTokens.accentHover,
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
