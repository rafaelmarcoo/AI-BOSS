"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Box,
  Button,
  ButtonBase,
  CircularProgress,
  Drawer,
  IconButton,
  InputBase,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Stack,
  Typography,
} from "@mui/material";
import AttachFileRoundedIcon from "@mui/icons-material/AttachFileRounded";
import ChatBubbleOutlineRoundedIcon from "@mui/icons-material/ChatBubbleOutlineRounded";
import CloudUploadOutlinedIcon from "@mui/icons-material/CloudUploadOutlined";
import FolderRoundedIcon from "@mui/icons-material/FolderRounded";
import RouteRoundedIcon from "@mui/icons-material/RouteRounded";
import SendRoundedIcon from "@mui/icons-material/SendRounded";
import { dashboardTokens } from "@/app/theme";
import { VoiceInputButton } from "@/components/voice-input-button";
import type { Conversation } from "@/types/database";
import {
  LANDING_BACKGROUND,
  LandingWelcomeHeader,
} from "./LandingWelcomeHeader";

type ChatConversationSummary = Pick<
  Conversation,
  "id" | "title" | "created_at" | "updated_at"
>;

const LANDING_CARD = "#FFFFFF";
const LANDING_CARD_HOVER = "#F2F7FB";
const LANDING_CARD_TEXT = "#163A5A";
const LANDING_CARD_MUTED = "#5F7890";
const LANDING_CARD_BORDER = "#D8E3EC";
const LANDING_ACTION = "#2B6A9B";
const LANDING_FONT_FAMILY =
  'var(--font-poppins), Poppins, "Segoe UI", sans-serif';

interface ConversationsApiResponse {
  success: boolean;
  data?: { conversations: ChatConversationSummary[] };
  error?: { message?: string };
}

interface LandingPageProps {
  fullName: string | null;
  email: string;
}

const QUICK_ACTIONS = [
  {
    id: "upload" as const,
    title: "Upload files",
    description: "Add statements, reports or financial documents.",
    meta: "PDF, CSV and XLSX",
    icon: CloudUploadOutlinedIcon,
  },
  {
    id: "documents" as const,
    title: "Manage documents",
    description: "Review, search or remove uploaded financial sources.",
    meta: "Sources and processing status",
    icon: FolderRoundedIcon,
  },
  {
    id: "scenarios" as const,
    title: "Scenarios",
    description: "Test forecasts and financial decisions.",
    meta: "Planning and what-if analysis",
    icon: RouteRoundedIcon,
  },
];

function formatConversationDate(value: string) {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function LandingPage({ fullName, email }: LandingPageProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadedDocument, setUploadedDocument] = useState<{
    id: string;
    fileName: string;
  } | null>(null);
  const [conversations, setConversations] = useState<ChatConversationSummary[]>(
    [],
  );
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);
  useEffect(() => {
    let isMounted = true;

    async function loadConversations() {
      try {
        const response = await fetch("/api/chat/conversations");
        const payload = (await response.json()) as ConversationsApiResponse;

        if (!response.ok || !payload.success) {
          throw new Error(
            payload.error?.message ?? "Could not load conversation history.",
          );
        }

        if (isMounted) {
          setConversations(payload.data?.conversations ?? []);
          setHistoryError(null);
        }
      } catch (error) {
        if (isMounted) {
          setConversations([]);
          setHistoryError(
            error instanceof Error
              ? error.message
              : "Could not load conversation history.",
          );
        }
      } finally {
        if (isMounted) setHistoryLoading(false);
      }
    }

    void loadConversations();
    return () => {
      isMounted = false;
    };
  }, []);

  const openConversation = (conversationId: string) => {
    router.push(`/dashboard?conversationId=${encodeURIComponent(conversationId)}`);
  };

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

    router.push("/dashboard/scenarios");
  };

  const recentConversations = conversations.slice(0, 3);

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
      <LandingWelcomeHeader fullName={fullName} email={email} />

      <Stack
        sx={{
          width: "100%",
          maxWidth: dashboardTokens.contentMaxWidth,
          mx: "auto",
          px: { xs: 2, sm: 4, lg: 6 },
          py: { xs: 4, sm: 5, lg: 6 },
        }}
      >
        <Typography
          component="h1"
          sx={{
            color: dashboardTokens.text,
            fontSize: { xs: 24, sm: 28 },
            lineHeight: 1.25,
            fontWeight: 600,
            letterSpacing: "-0.025em",
          }}
        >
          What would you like to work on?
        </Typography>

        <Box sx={{ mt: 3 }}>
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
              minHeight: 60,
              display: "flex",
              alignItems: "center",
              gap: 0.5,
              px: { xs: 1.25, sm: 1.5 },
              borderRadius: `${dashboardTokens.radiusMd}px`,
              border: "1px solid",
              borderColor: LANDING_CARD_BORDER,
              bgcolor: LANDING_CARD,
              transition: "border-color 140ms ease, box-shadow 140ms ease",
              "&:focus-within": {
                borderColor: LANDING_ACTION,
                boxShadow: "0 0 0 3px rgba(43, 106, 155, 0.2)",
              },
            }}
          >
            <InputBase
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Ask AI-BOSS about your business finances..."
              inputProps={{ "aria-label": "Ask AI-BOSS about your business finances" }}
              sx={{
                flex: "1 1 auto",
                minWidth: 0,
                color: LANDING_CARD_TEXT,
                fontSize: 14,
                "& input::placeholder": {
                  color: LANDING_CARD_MUTED,
                  opacity: 1,
                },
              }}
            />
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
            <IconButton
              type="submit"
              aria-label="Send message"
              disabled={!message.trim()}
              sx={{
                width: 36,
                height: 36,
                borderRadius: `${dashboardTokens.radiusSm}px`,
                color: message.trim() ? "#FFFFFF" : LANDING_CARD_MUTED,
                bgcolor: message.trim() ? LANDING_ACTION : "#EAF2F8",
                "&:hover": {
                  bgcolor: message.trim() ? "#21577F" : "#DCE9F2",
                },
                "&.Mui-disabled": { color: LANDING_CARD_MUTED },
              }}
            >
              <SendRoundedIcon fontSize="small" />
            </IconButton>
          </Box>
          <Typography
            sx={{ mt: 1, color: "#B8C7D9", fontSize: 12 }}
          >
            AI-BOSS provides financial insights. Review important decisions before acting.
          </Typography>
          {uploading ? (
            <Alert
              severity="info"
              icon={<CircularProgress size={18} />}
              sx={{ mt: 2 }}
            >
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

        <Box component="section" sx={{ mt: 4 }}>
          <Typography component="h2" sx={{ fontSize: 15, fontWeight: 600 }}>
            Quick actions
          </Typography>
          <Box
            sx={{
              mt: 1.5,
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                sm: "repeat(3, minmax(0, 1fr))",
              },
              gap: 2,
            }}
          >
            {QUICK_ACTIONS.map((action) => {
              const Icon = action.icon;

              return (
                <ButtonBase
                  key={action.title}
                  onClick={() => handleQuickAction(action.id)}
                  disabled={action.id === "upload" && uploading}
                  aria-label={action.title}
                  sx={{
                    width: "100%",
                    minHeight: 142,
                    p: 2.5,
                    display: "block",
                    textAlign: "left",
                    borderRadius: `${dashboardTokens.radiusMd}px`,
                    border: "1px solid",
                    borderColor: LANDING_CARD_BORDER,
                    bgcolor: LANDING_CARD,
                    color: LANDING_CARD_TEXT,
                    transition: "background-color 140ms ease, border-color 140ms ease, transform 140ms ease",
                    "&:hover": {
                      bgcolor: LANDING_CARD_HOVER,
                      borderColor: "#9DB6CA",
                      transform: "translateY(-1px)",
                    },
                  }}
                >
                  <Icon sx={{ fontSize: 22, color: LANDING_ACTION }} />
                  <Typography sx={{ mt: 1.75, fontSize: 16, fontWeight: 500 }}>
                    {action.title}
                  </Typography>
                  <Typography
                    sx={{ mt: 0.5, color: LANDING_CARD_MUTED, fontSize: 14, lineHeight: 1.45 }}
                  >
                    {action.description}
                  </Typography>
                  <Typography sx={{ mt: 1, color: "#7890A5", fontSize: 12 }}>
                    {action.meta}
                  </Typography>
                </ButtonBase>
              );
            })}
          </Box>
        </Box>

        {!historyLoading && recentConversations.length > 0 ? (
          <Box
            component="section"
            sx={{
              mt: 4,
              p: { xs: 2, sm: 2.5 },
              borderRadius: 2.5,
              bgcolor: LANDING_CARD,
              color: LANDING_CARD_TEXT,
              border: "1px solid",
              borderColor: LANDING_CARD_BORDER,
            }}
          >
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Typography component="h2" sx={{ fontSize: 15, fontWeight: 600 }}>
                Recent conversations
              </Typography>
              <Button
                size="small"
                onClick={() => setHistoryOpen(true)}
                sx={{ color: LANDING_ACTION, textTransform: "none", fontSize: 13 }}
              >
                View all
              </Button>
            </Stack>
            <List
              disablePadding
              sx={{ mt: 1, borderTop: "1px solid", borderColor: LANDING_CARD_BORDER }}
            >
              {recentConversations.map((conversation) => (
                <ListItem key={conversation.id} disablePadding>
                  <ListItemButton
                    onClick={() => openConversation(conversation.id)}
                    sx={{
                      px: 0,
                      py: 1.25,
                      borderBottom: "1px solid",
                      borderColor: LANDING_CARD_BORDER,
                      "&:hover": { bgcolor: LANDING_CARD_HOVER },
                      "&:hover .conversation-title": { color: LANDING_ACTION },
                    }}
                  >
                    <ListItemText
                      primary={conversation.title ?? "Untitled conversation"}
                      secondary={formatConversationDate(conversation.updated_at)}
                      primaryTypographyProps={{
                        className: "conversation-title",
                        color: LANDING_CARD_TEXT,
                        fontSize: 14,
                        fontWeight: 500,
                      }}
                      secondaryTypographyProps={{
                        color: LANDING_CARD_MUTED,
                        fontSize: 12,
                      }}
                    />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          </Box>
        ) : null}
      </Stack>

      <Drawer
        anchor="left"
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        PaperProps={{
          sx: {
            width: { xs: "100vw", sm: 380 },
            maxWidth: "100vw",
            bgcolor: dashboardTokens.sidebar,
            color: dashboardTokens.text,
            borderRight: "1px solid",
            borderRightColor: dashboardTokens.border,
            p: { xs: 1.5, sm: 2 },
            boxSizing: "border-box",
          },
        }}
      >
        <Stack spacing={2} sx={{ height: "100%" }}>
          <Stack direction="row" spacing={1.25} alignItems="center">
            <ChatBubbleOutlineRoundedIcon sx={{ color: dashboardTokens.textMuted }} />
            <Box sx={{ minWidth: 0 }}>
              <Typography component="h2" sx={{ fontSize: 16, fontWeight: 600 }}>
                Past chats
              </Typography>
              <Typography
                sx={{
                  color: dashboardTokens.textMuted,
                  fontSize: 13,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {fullName ?? email}
              </Typography>
            </Box>
          </Stack>

          <Box sx={{ flex: "1 1 0", minHeight: 0, overflow: "auto" }}>
            {historyLoading ? (
              <Typography sx={{ color: dashboardTokens.textMuted, fontSize: 14 }}>
                Loading conversations...
              </Typography>
            ) : historyError ? (
              <Typography sx={{ color: "#E56565", fontSize: 14 }}>
                {historyError}
              </Typography>
            ) : conversations.length === 0 ? (
              <Typography sx={{ color: dashboardTokens.textMuted, fontSize: 14 }}>
                No saved conversations yet.
              </Typography>
            ) : (
              <List disablePadding sx={{ display: "grid", gap: 0.5 }}>
                {conversations.map((conversation) => (
                  <ListItem key={conversation.id} disablePadding>
                    <ListItemButton
                      onClick={() => openConversation(conversation.id)}
                      sx={{
                        borderRadius: `${dashboardTokens.radiusSm}px`,
                        "&:hover": { bgcolor: dashboardTokens.surfaceAlt },
                      }}
                    >
                      <ListItemText
                        primary={conversation.title ?? "Untitled conversation"}
                        secondary={formatConversationDate(conversation.updated_at)}
                        primaryTypographyProps={{
                          color: dashboardTokens.text,
                          fontSize: 14,
                          fontWeight: 500,
                          noWrap: true,
                        }}
                        secondaryTypographyProps={{
                          color: dashboardTokens.textSubtle,
                          fontSize: 12,
                          noWrap: true,
                        }}
                      />
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
            )}
          </Box>

          <Button
            variant="outlined"
            onClick={() => router.push("/dashboard")}
            sx={{
              minHeight: 36,
              borderRadius: `${dashboardTokens.radiusSm}px`,
              color: dashboardTokens.text,
              borderColor: dashboardTokens.borderMuted,
              textTransform: "none",
            }}
          >
            Open workspace
          </Button>
        </Stack>
      </Drawer>
    </Box>
  );
}

const composerControlSx = {
  width: 36,
  height: 36,
  borderRadius: `${dashboardTokens.radiusSm}px`,
  color: LANDING_ACTION,
  "&:hover": {
    color: LANDING_CARD_TEXT,
    bgcolor: "#EAF2F8",
  },
};
