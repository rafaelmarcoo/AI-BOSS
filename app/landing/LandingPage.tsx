"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Box,
  Button,
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
import AccountBalanceWalletRoundedIcon from "@mui/icons-material/AccountBalanceWalletRounded";
import AttachFileRoundedIcon from "@mui/icons-material/AttachFileRounded";
import ChatBubbleOutlineRoundedIcon from "@mui/icons-material/ChatBubbleOutlineRounded";
import CloudUploadRoundedIcon from "@mui/icons-material/CloudUploadRounded";
import MenuRoundedIcon from "@mui/icons-material/MenuRounded";
import MicRoundedIcon from "@mui/icons-material/MicRounded";
import RouteRoundedIcon from "@mui/icons-material/RouteRounded";
import SendRoundedIcon from "@mui/icons-material/SendRounded";
import { dashboardTokens } from "@/app/theme";
import { SignOutButton } from "@/components/sign-out-button";
import type { Conversation } from "@/types/database";

type ChatConversationSummary = Pick<
  Conversation,
  "id" | "title" | "created_at" | "updated_at"
>;

interface ConversationsApiResponse {
  success: boolean;
  data?: {
    conversations: ChatConversationSummary[];
  };
  error?: {
    message?: string;
  };
}

interface LandingPageProps {
  fullName: string | null;
  email: string;
}

const OPTION_CARDS = [
  {
    title: "Upload",
    description: "Upload CSV, PDF, PNG, JPEG, etc.",
    icon: CloudUploadRoundedIcon,
  },
  {
    title: "Accounts",
    description: "View and manage your accounts.",
    icon: AccountBalanceWalletRoundedIcon,
  },
  {
    title: "Scenario",
    description:
      "Run or explore financial scenarios, forecasts, or what-if planning.",
    icon: RouteRoundedIcon,
  },
];

function getFirstName(fullName: string | null, email: string) {
  const trimmedName = fullName?.trim();

  if (trimmedName) {
    return trimmedName.split(/\s+/)[0];
  }

  return email.split("@")[0] || "there";
}

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
  const [historyOpen, setHistoryOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [conversations, setConversations] = useState<ChatConversationSummary[]>(
    [],
  );
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const firstName = useMemo(() => getFirstName(fullName, email), [email, fullName]);

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
        if (isMounted) {
          setHistoryLoading(false);
        }
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

    if (!trimmed) {
      return;
    }

    router.push(`/dashboard?initialMessage=${encodeURIComponent(trimmed)}`);
  };

  const handleAttachmentClick = () => {
    // TODO: Connect this to the document upload flow when landing attachments are supported.
  };

  const handleMicrophoneClick = () => {
    // TODO: Connect this to voice input when speech capture is supported.
  };

  return (
    <Box
      component="main"
      sx={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        bgcolor: dashboardTokens.sidebarV2,
        color: "common.white",
      }}
    >
      <Stack
        component="header"
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{
          px: { xs: 2, sm: 4, lg: 6 },
          py: { xs: 1.5, sm: 2 },
          borderBottom: "1px solid",
          borderBottomColor: dashboardTokens.border,
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <IconButton
            aria-label="Open past chats"
            onClick={() => setHistoryOpen(true)}
            sx={{
              width: 44,
              height: 44,
              color: "common.white",
              border: "1px solid",
              borderColor: dashboardTokens.border,
              bgcolor: "rgba(255,255,255,0.03)",
              "&:hover": {
                bgcolor: "rgba(255,255,255,0.08)",
              },
            }}
          >
            <MenuRoundedIcon />
          </IconButton>
          <Typography
            variant="h6"
            component="p"
            sx={{
              display: { xs: "none", sm: "block" },
              fontWeight: 700,
              letterSpacing: 0,
            }}
          >
            AI-BOSS
          </Typography>
        </Stack>

        <SignOutButton />
      </Stack>

      <Stack
        sx={{
          width: "100%",
          maxWidth: 1280,
          mx: "auto",
          flex: "1 1 auto",
          px: { xs: 2, sm: 4, lg: 6 },
          py: { xs: 4, sm: 6, lg: 8 },
          gap: { xs: 4, lg: 6 },
        }}
      >
        <Stack spacing={1.25}>
          <Typography
            variant="h2"
            component="h1"
            sx={{
              fontSize: { xs: "2.25rem", sm: "3rem", lg: "3.75rem" },
              lineHeight: 1,
              fontWeight: 750,
              letterSpacing: 0,
            }}
          >
            Hello, {firstName}
          </Typography>
          <Typography
            variant="h3"
            component="p"
            sx={{
              maxWidth: 900,
              color: "rgba(255,255,255,0.92)",
              fontSize: { xs: "1.6rem", sm: "2.25rem", lg: "2.75rem" },
              lineHeight: 1.14,
              fontWeight: 650,
              letterSpacing: 0,
            }}
          >
            How can I help with your finances today?
          </Typography>
        </Stack>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr",
              md: "repeat(3, minmax(0, 1fr))",
            },
            gap: { xs: 1.5, md: 2 },
          }}
        >
          {/* TODO: Add card action handlers when Upload, Accounts, and Scenario flows are ready. */}
          {OPTION_CARDS.map((card) => {
            const Icon = card.icon;

            return (
              <Box
                key={card.title}
                sx={{
                  minHeight: { xs: 160, sm: 190 },
                  display: "grid",
                  gridTemplateColumns: { xs: "72px 1fr", sm: "96px 1fr" },
                  alignItems: "center",
                  gap: { xs: 2, sm: 2.5 },
                  p: { xs: 2, sm: 3 },
                  borderRadius: 2,
                  border: "1px solid",
                  borderColor: dashboardTokens.borderSoft,
                  bgcolor: "rgba(255,255,255,0.035)",
                  boxShadow: "0 20px 70px rgba(0,0,0,0.22)",
                }}
              >
                <Box
                  sx={{
                    width: { xs: 64, sm: 86 },
                    height: { xs: 64, sm: 86 },
                    borderRadius: 2,
                    display: "grid",
                    placeItems: "center",
                    bgcolor: "rgba(255,255,255,0.06)",
                    color: "#93c5fd",
                  }}
                >
                  <Icon sx={{ fontSize: { xs: 34, sm: 44 } }} />
                </Box>
                <Stack spacing={1}>
                  <Typography
                    variant="h5"
                    component="h2"
                    sx={{
                      fontSize: { xs: "1.25rem", sm: "1.5rem" },
                      lineHeight: 1.1,
                      fontWeight: 700,
                    }}
                  >
                    {card.title}
                  </Typography>
                  <Typography
                    variant="body1"
                    sx={{
                      color: dashboardTokens.textSoft,
                      fontSize: { xs: "1rem", sm: "1.1rem" },
                      lineHeight: 1.45,
                    }}
                  >
                    {card.description}
                  </Typography>
                </Stack>
              </Box>
            );
          })}
        </Box>

        <Box
          component="form"
          onSubmit={submitMessage}
          sx={{
            mt: "auto",
            display: "flex",
            alignItems: "center",
            gap: 1,
            minHeight: { xs: 68, sm: 78 },
            px: { xs: 2, sm: 3 },
            borderRadius: 999,
            border: "1px solid",
            borderColor: "rgba(147,197,253,0.65)",
            bgcolor: "rgba(2,2,5,0.62)",
          }}
        >
          <InputBase
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Send a message..."
            inputProps={{ "aria-label": "Send a message to AI-BOSS" }}
            sx={{
              flex: "1 1 auto",
              minWidth: 0,
              color: "common.white",
              fontSize: { xs: "1rem", sm: "1.2rem" },
              "& input::placeholder": {
                color: dashboardTokens.textMuted,
                opacity: 1,
              },
            }}
          />
          <IconButton
            type="button"
            aria-label="Attach a file"
            onClick={handleAttachmentClick}
            sx={{ color: dashboardTokens.textMuted }}
          >
            <AttachFileRoundedIcon />
          </IconButton>
          <IconButton
            type="button"
            aria-label="Start voice input"
            onClick={handleMicrophoneClick}
            sx={{ color: dashboardTokens.textMuted }}
          >
            <MicRoundedIcon />
          </IconButton>
          <IconButton
            type="submit"
            aria-label="Send message"
            disabled={!message.trim()}
            sx={{
              color: "common.white",
              bgcolor: message.trim() ? "#2563eb" : "rgba(255,255,255,0.05)",
              "&:hover": {
                bgcolor: message.trim() ? "#1d4ed8" : "rgba(255,255,255,0.05)",
              },
              "&.Mui-disabled": {
                color: dashboardTokens.textMuted,
              },
            }}
          >
            <SendRoundedIcon />
          </IconButton>
        </Box>

        <Typography
          variant="body2"
          sx={{
            textAlign: "center",
            color: dashboardTokens.textMuted,
          }}
        >
          AI helps with insights. Check important financial details.
        </Typography>
      </Stack>

      <Drawer
        anchor="left"
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        PaperProps={{
          sx: {
            width: { xs: "100vw", sm: 380 },
            maxWidth: "100vw",
            bgcolor: "#080910",
            color: "common.white",
            borderRight: "1px solid",
            borderRightColor: dashboardTokens.border,
            p: { xs: 1.5, sm: 2 },
            boxSizing: "border-box",
          },
        }}
      >
        <Stack spacing={2} sx={{ height: "100%" }}>
          <Stack direction="row" spacing={1.25} alignItems="center">
            <ChatBubbleOutlineRoundedIcon />
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="h6" component="h2" fontWeight={700}>
                Past chats
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  color: dashboardTokens.textMuted,
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
              <Typography variant="body2" sx={{ color: dashboardTokens.textMuted }}>
                Loading conversations...
              </Typography>
            ) : historyError ? (
              <Typography variant="body2" sx={{ color: "#fca5a5" }}>
                {historyError}
              </Typography>
            ) : conversations.length === 0 ? (
              <Typography variant="body2" sx={{ color: dashboardTokens.textMuted }}>
                No saved conversations yet.
              </Typography>
            ) : (
              <List disablePadding sx={{ display: "grid", gap: 0.75 }}>
                {conversations.map((conversation) => (
                  <ListItem key={conversation.id} disablePadding>
                    <ListItemButton
                      onClick={() => openConversation(conversation.id)}
                      sx={{
                        borderRadius: 2,
                        border: "1px solid",
                        borderColor: dashboardTokens.border,
                        bgcolor: "rgba(255,255,255,0.03)",
                        "&:hover": {
                          bgcolor: "rgba(255,255,255,0.08)",
                        },
                      }}
                    >
                      <ListItemText
                        primary={conversation.title ?? "Untitled conversation"}
                        secondary={formatConversationDate(conversation.updated_at)}
                        primaryTypographyProps={{
                          color: "common.white",
                          fontSize: 14,
                          fontWeight: 650,
                          noWrap: true,
                        }}
                        secondaryTypographyProps={{
                          color: dashboardTokens.textMuted,
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
              borderRadius: 999,
              color: "common.white",
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
