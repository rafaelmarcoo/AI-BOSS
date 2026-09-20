"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Avatar,
  Box,
  Button,
  ButtonBase,
  Chip,
  CircularProgress,
  IconButton,
  InputBase,
  Stack,
  Typography,
} from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import AttachFileRoundedIcon from "@mui/icons-material/AttachFileRounded";
import ChatBubbleOutlineRoundedIcon from "@mui/icons-material/ChatBubbleOutlineRounded";
import CloudUploadOutlinedIcon from "@mui/icons-material/CloudUploadOutlined";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import SendRoundedIcon from "@mui/icons-material/SendRounded";
import SpeedRoundedIcon from "@mui/icons-material/SpeedRounded";
import { dashboardTokens } from "@/app/theme";
import { VoiceInputButton } from "@/components/voice-input-button";
import type { Conversation } from "@/types/database";
import {
  LANDING_BACKGROUND,
  LANDING_SECONDARY,
  LandingWelcomeHeader,
} from "./LandingWelcomeHeader";

const LANDING_CARD = "#FBFAF7";
const LANDING_CARD_TEXT = "#163A5A";
const LANDING_CARD_MUTED = "#66788C";
const LANDING_CARD_BORDER = "#D8E3EC";
const LANDING_ACTION_SURFACE = "#193B5A";
const LANDING_ACTION_SURFACE_HOVER = "#214967";
const LANDING_FONT_FAMILY =
  'var(--font-poppins), Poppins, "Segoe UI", sans-serif';

interface LandingPageProps {
  fullName: string | null;
  email: string;
  companyName: string | null;
}

type RecentConversation = Pick<
  Conversation,
  "id" | "title" | "updated_at" | "visibility"
>;

interface ConversationsApiResponse {
  success: boolean;
  data?: { conversations: RecentConversation[] };
  error?: { message?: string };
}

const QUICK_ACTIONS = [
  {
    id: "upload" as const,
    title: "Upload files",
    description: "Add a PDF, CSV or XLSX",
    ariaLabel: "Upload files",
    icon: CloudUploadOutlinedIcon,
  },
  {
    id: "documents" as const,
    title: "Manage documents",
    description: "Review your sources",
    ariaLabel: "Manage documents",
    icon: DescriptionOutlinedIcon,
  },
  {
    id: "scenarios" as const,
    title: "Create a scenario",
    description: "Test a future decision",
    ariaLabel: "Scenarios",
    icon: AddRoundedIcon,
  },
  {
    id: "runway" as const,
    title: "Review runway",
    description: "See your cash outlook",
    ariaLabel: "Review runway",
    icon: SpeedRoundedIcon,
  },
];

function getDisplayName(fullName: string | null, email: string) {
  return fullName?.trim() || email.split("@")[0] || "there";
}

function getInitials(displayName: string) {
  const parts = displayName.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts.at(-1)?.[0] ?? ""}`.toUpperCase();
}

function formatToday() {
  return new Intl.DateTimeFormat("en-NZ", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());
}

function formatConversationDate(value: string) {
  const date = new Date(value);
  const today = new Date();
  const sameDay =
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();
  const time = date.toLocaleTimeString("en-NZ", {
    hour: "numeric",
    minute: "2-digit",
  });

  if (sameDay) return `Today, ${time}`;

  const day = date.toLocaleDateString("en-NZ", {
    day: "numeric",
    month: "short",
  });
  return `${day}, ${time}`;
}

function visibilityLabel(visibility: RecentConversation["visibility"]) {
  if (visibility === "company") return "Company";
  if (visibility === "admins") return "Admins";
  return "Private";
}

export function LandingPage({ fullName, email, companyName }: LandingPageProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [message, setMessage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadedDocument, setUploadedDocument] = useState<{
    id: string;
    fileName: string;
  } | null>(null);
  const [conversations, setConversations] = useState<RecentConversation[]>([]);
  const [conversationsLoading, setConversationsLoading] = useState(true);
  const [conversationsError, setConversationsError] = useState<string | null>(null);
  const displayName = getDisplayName(fullName, email);
  const firstName = displayName.split(/\s+/)[0];
  const initials = getInitials(displayName);

  useEffect(() => {
    let active = true;

    async function loadConversations() {
      try {
        const response = await fetch("/api/chat/conversations");
        const payload = (await response.json()) as ConversationsApiResponse;

        if (!response.ok || !payload.success) {
          throw new Error(
            payload.error?.message ?? "Could not load recent conversations.",
          );
        }

        if (active) {
          setConversations(payload.data?.conversations.slice(0, 3) ?? []);
          setConversationsError(null);
        }
      } catch (error) {
        if (active) {
          setConversations([]);
          setConversationsError(
            error instanceof Error
              ? error.message
              : "Could not load recent conversations.",
          );
        }
      } finally {
        if (active) setConversationsLoading(false);
      }
    }

    void loadConversations();
    return () => {
      active = false;
    };
  }, []);

  const submitMessage = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = message.trim();

    if (trimmed) {
      router.push(`/dashboard?initialMessage=${encodeURIComponent(trimmed)}`);
    }
  };

  const handleAttachmentClick = () => {
    if (!uploading) fileInputRef.current?.click();
  };

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.set("file", file);
    setUploading(true);
    setUploadError(null);
    setUploadedDocument(null);

    try {
      const response = await fetch("/api/documents", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as {
        success: boolean;
        data?: { document?: { id: string; file_name: string } };
        error?: { message?: string };
      };

      if (!response.ok || !payload.success || !payload.data?.document) {
        throw new Error(payload.error?.message ?? "Could not upload the document.");
      }

      setUploadedDocument({
        id: payload.data.document.id,
        fileName: payload.data.document.file_name,
      });
    } catch (error) {
      setUploadError(
        error instanceof Error ? error.message : "Could not upload the document.",
      );
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  const handleQuickAction = (actionId: (typeof QUICK_ACTIONS)[number]["id"]) => {
    if (actionId === "upload") {
      handleAttachmentClick();
      return;
    }

    if (actionId === "documents") {
      router.push("/dashboard/documents");
      return;
    }

    if (actionId === "scenarios") {
      router.push("/dashboard/scenarios");
      return;
    }

    router.push("/dashboard");
  };

  return (
    <Box
      component="main"
      sx={{
        minHeight: "100vh",
        bgcolor: LANDING_BACKGROUND,
        color: dashboardTokens.text,
        fontFamily: LANDING_FONT_FAMILY,
        "& .MuiTypography-root, & .MuiButtonBase-root, & .MuiInputBase-root": {
          fontFamily: LANDING_FONT_FAMILY,
        },
      }}
    >
      <LandingWelcomeHeader
        fullName={fullName}
        email={email}
        companyName={companyName}
      />

      <Stack
        sx={{
          width: { xs: "100%", md: "65%" },
          mx: "auto",
          px: { xs: 2, sm: 4, lg: 6 },
          pt: { xs: 4, sm: 5, lg: 6 },
          pb: { xs: 4, sm: 6 },
        }}
      >
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Avatar
            sx={{
              width: { xs: 42, sm: 46 },
              height: { xs: 42, sm: 46 },
              bgcolor: "#FFD1C3",
              color: LANDING_BACKGROUND,
              fontSize: 12,
              fontWeight: 500,
            }}
          >
            {initials}
          </Avatar>
          <Box>
            <Typography sx={{ color: "#B8C7D9", fontSize: 12, fontWeight: 400 }}>
              {formatToday()}
            </Typography>
            <Typography
              component="h1"
              sx={{
                mt: 0.15,
                color: "#FFFFFF",
                fontSize: { xs: 30, sm: 36 },
                lineHeight: 1.08,
                fontWeight: 600,
                letterSpacing: "-0.03em",
              }}
            >
              Hello, {firstName}
            </Typography>
          </Box>
        </Stack>

        <Typography
          component="h2"
          sx={{
            mt: { xs: 4, sm: 4.5 },
            color: "#C5D1DE",
            fontSize: { xs: 20, sm: 24 },
            fontWeight: 500,
            letterSpacing: "-0.02em",
          }}
        >
          What would you like to work on?
        </Typography>

        <Box sx={{ mt: 2 }}>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.csv,.xlsx,application/pdf,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            hidden
            onChange={(event) => void handleFileChange(event)}
          />
          <Box
            component="form"
            onSubmit={submitMessage}
            sx={{
              minHeight: { xs: 164, sm: 150 },
              p: { xs: 1.5, sm: 1.75 },
              display: "flex",
              flexDirection: "column",
              border: "1px solid",
              borderColor: LANDING_CARD_BORDER,
              borderRadius: "14px",
              bgcolor: LANDING_CARD,
              boxShadow: "0 14px 30px rgba(4, 20, 34, 0.16)",
              transition: "border-color 140ms ease, box-shadow 140ms ease",
              "&:focus-within": {
                borderColor: LANDING_SECONDARY,
                boxShadow: "0 0 0 3px rgba(242, 140, 91, 0.18)",
              },
            }}
          >
            <InputBase
              multiline
              minRows={3}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Ask AI-BOSS about your business finances..."
              inputProps={{ "aria-label": "Ask AI-BOSS about your business finances" }}
              sx={{
                flex: "1 1 auto",
                minWidth: 0,
                alignItems: "flex-start",
                color: LANDING_CARD_TEXT,
                fontSize: 13,
                fontWeight: 400,
                lineHeight: 1.5,
                "& textarea::placeholder": {
                  color: LANDING_CARD_MUTED,
                  opacity: 1,
                },
              }}
            />

            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Stack direction="row" spacing={0.25} alignItems="center">
                <IconButton
                  type="button"
                  aria-label="Attach a file"
                  onClick={handleAttachmentClick}
                  disabled={uploading}
                  sx={composerControlSx}
                >
                  <AttachFileRoundedIcon fontSize="small" />
                </IconButton>
                <VoiceInputButton
                  tone="light"
                  onTranscript={(transcript) =>
                    setMessage((current) =>
                      [current.trimEnd(), transcript.trim()].filter(Boolean).join(" "),
                    )
                  }
                />
              </Stack>
              <IconButton
                type="submit"
                aria-label="Send message"
                disabled={!message.trim()}
                sx={{
                  width: 34,
                  height: 34,
                  borderRadius: "11px",
                  color: message.trim() ? LANDING_BACKGROUND : "#8EA0B1",
                  bgcolor: message.trim() ? LANDING_SECONDARY : "#E8EDF1",
                  "&:hover": {
                    bgcolor: message.trim() ? "#E57D4C" : "#DCE4EA",
                  },
                  "&.Mui-disabled": { color: "#8EA0B1" },
                }}
              >
                <SendRoundedIcon fontSize="small" />
              </IconButton>
            </Stack>
          </Box>

          {uploading ? (
            <Alert severity="info" icon={<CircularProgress size={18} />} sx={{ mt: 2 }}>
              Uploading your document…
            </Alert>
          ) : null}
          {uploadError ? (
            <Alert severity="error" onClose={() => setUploadError(null)} sx={{ mt: 2 }}>
              {uploadError}
            </Alert>
          ) : null}
          {uploadedDocument ? (
            <Alert
              severity="success"
              onClose={() => setUploadedDocument(null)}
              sx={{ mt: 2 }}
              action={
                <Stack direction="row" spacing={0.5}>
                  <Button
                    color="inherit"
                    size="small"
                    onClick={() =>
                      router.push(
                        `/dashboard/documents/${encodeURIComponent(uploadedDocument.id)}`,
                      )
                    }
                  >
                    Review extracted data
                  </Button>
                  <Button
                    color="inherit"
                    size="small"
                    onClick={() => router.push("/dashboard")}
                  >
                    Open workspace
                  </Button>
                </Stack>
              }
            >
              {uploadedDocument.fileName} was uploaded and is being processed.
            </Alert>
          ) : null}
        </Box>

        <Box
          component="section"
          aria-label="Quick actions"
          sx={{
            mt: 2.75,
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr",
              sm: "repeat(2, minmax(0, 1fr))",
              lg: "repeat(4, minmax(0, 1fr))",
            },
            gap: 1.25,
          }}
        >
          {QUICK_ACTIONS.map((action) => {
            const Icon = action.icon;

            return (
              <ButtonBase
                key={action.id}
                onClick={() => handleQuickAction(action.id)}
                disabled={action.id === "upload" && uploading}
                aria-label={action.ariaLabel}
                sx={{
                  minHeight: 110,
                  p: 2,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  justifyContent: "center",
                  textAlign: "left",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: "22px",
                  bgcolor: LANDING_ACTION_SURFACE,
                  color: "#FFFFFF",
                  transition: "background-color 150ms ease, transform 150ms ease",
                  "&:hover": {
                    bgcolor: LANDING_ACTION_SURFACE_HOVER,
                    transform: "translateY(-2px)",
                  },
                  "&:focus-visible": {
                    outline: `2px solid ${LANDING_SECONDARY}`,
                    outlineOffset: 2,
                  },
                }}
              >
                <Icon sx={{ color: LANDING_SECONDARY, fontSize: 21 }} />
                <Typography sx={{ mt: 1.4, fontSize: 13, fontWeight: 600 }}>
                  {action.title}
                </Typography>
                <Typography
                  sx={{ mt: 0.35, color: "#B8C7D9", fontSize: 11, fontWeight: 400 }}
                >
                  {action.description}
                </Typography>
              </ButtonBase>
            );
          })}
        </Box>
      </Stack>

      <Box
        component="section"
        aria-labelledby="recent-conversations-heading"
        sx={{
          mt: { xs: 1, sm: 2 },
          py: { xs: 4, sm: 5 },
          bgcolor: "#FBFAF7",
          color: "#12263D",
        }}
      >
        <Stack
          sx={{
            width: { xs: "100%", md: "65%" },
            mx: "auto",
            px: { xs: 2, sm: 4, lg: 6 },
          }}
        >
          <Typography sx={{ color: "#66788C", fontSize: 11, fontWeight: 400 }}>
            Pick up where you left off
          </Typography>
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            spacing={2}
          >
            <Typography
              id="recent-conversations-heading"
              component="h2"
              sx={{ fontSize: { xs: 22, sm: 24 }, fontWeight: 500 }}
            >
              Recent conversations
            </Typography>
            <Button
              endIcon={<ArrowForwardRoundedIcon fontSize="small" />}
              onClick={() => router.push("/dashboard")}
              sx={{
                color: "#12263D",
                textTransform: "none",
                fontSize: 12,
                fontWeight: 500,
              }}
            >
              View all
            </Button>
          </Stack>

          <Box
            sx={{
              mt: 2.25,
              overflow: "hidden",
              border: "1px solid #E7E5E1",
              borderRadius: "20px",
              bgcolor: "#FFFFFF",
              boxShadow: "0 14px 34px rgba(16, 42, 67, 0.07)",
            }}
          >
            {conversationsLoading ? (
              <Stack direction="row" spacing={1} alignItems="center" sx={{ p: 3 }}>
                <CircularProgress size={18} sx={{ color: LANDING_SECONDARY }} />
                <Typography sx={{ color: "#66788C", fontSize: 12 }}>
                  Loading conversations…
                </Typography>
              </Stack>
            ) : conversationsError ? (
              <Alert severity="error" sx={{ m: 2 }}>
                {conversationsError}
              </Alert>
            ) : conversations.length === 0 ? (
              <Stack alignItems="center" spacing={0.75} sx={{ p: 4, textAlign: "center" }}>
                <ChatBubbleOutlineRoundedIcon sx={{ color: LANDING_SECONDARY }} />
                <Typography sx={{ fontSize: 13, fontWeight: 600 }}>
                  No conversations yet
                </Typography>
                <Typography sx={{ color: "#66788C", fontSize: 11, fontWeight: 400 }}>
                  Ask AI-BOSS a question above to get started.
                </Typography>
              </Stack>
            ) : (
              conversations.map((conversation, index) => (
                <ButtonBase
                  key={conversation.id}
                  onClick={() =>
                    router.push(
                      `/dashboard?conversationId=${encodeURIComponent(conversation.id)}`,
                    )
                  }
                  sx={{
                    width: "100%",
                    p: { xs: 2, sm: 2.25 },
                    display: "flex",
                    alignItems: "center",
                    gap: 1.5,
                    textAlign: "left",
                    borderBottom: index < conversations.length - 1 ? "1px solid #E2E1DE" : "none",
                    "&:hover": { bgcolor: "#F7F7F4" },
                  }}
                >
                  <Box
                    sx={{
                      width: 42,
                      height: 42,
                      flex: "0 0 auto",
                      display: "grid",
                      placeItems: "center",
                      borderRadius: "50%",
                      bgcolor: index === 0 ? "#FFE1D5" : "#F0EFEC",
                      color: index === 0 ? LANDING_SECONDARY : "#66788C",
                    }}
                  >
                    <ChatBubbleOutlineRoundedIcon fontSize="small" />
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography
                      sx={{ fontSize: { xs: 13, sm: 14 }, fontWeight: 600 }}
                      noWrap
                    >
                      {conversation.title ?? "Untitled conversation"}
                    </Typography>
                    <Typography sx={{ mt: 0.25, color: "#66788C", fontSize: 11, fontWeight: 400 }}>
                      {formatConversationDate(conversation.updated_at)}
                    </Typography>
                  </Box>
                  <Chip
                    label={visibilityLabel(conversation.visibility)}
                    size="small"
                    sx={{
                      height: 25,
                      flex: "0 0 auto",
                      bgcolor: "#F3F1ED",
                      color: "#66788C",
                      fontSize: 10,
                      fontWeight: 400,
                    }}
                  />
                </ButtonBase>
              ))
            )}
          </Box>
        </Stack>
      </Box>
    </Box>
  );
}

const composerControlSx = {
  width: 34,
  height: 34,
  borderRadius: "10px",
  color: LANDING_CARD_MUTED,
  "&:hover": {
    color: LANDING_CARD_TEXT,
    bgcolor: "#E9EEF2",
  },
};
