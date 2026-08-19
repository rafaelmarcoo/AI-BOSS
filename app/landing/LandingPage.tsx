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
import CloudUploadOutlinedIcon from "@mui/icons-material/CloudUploadOutlined";
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
  data?: { conversations: ChatConversationSummary[] };
  error?: { message?: string };
}

interface LandingPageProps {
  fullName: string | null;
  email: string;
}

const QUICK_ACTIONS = [
  {
    title: "Upload files",
    description: "Add statements, reports or financial documents.",
    meta: "CSV, PDF and images",
    icon: CloudUploadOutlinedIcon,
    href: "/dashboard/documents",
  },
  {
    title: "Accounts",
    description: "View and manage connected accounts.",
    meta: "Connections and balances",
    icon: AccountBalanceWalletRoundedIcon,
    href: undefined,
  },
  {
    title: "Scenarios",
    description: "Test forecasts and financial decisions.",
    meta: "Planning and what-if analysis",
    icon: RouteRoundedIcon,
    href: undefined,
  },
] satisfies Array<{
  title: string;
  description: string;
  meta: string;
  icon: typeof CloudUploadOutlinedIcon;
  href: string | undefined;
}>;

function getFirstName(fullName: string | null, email: string) {
  const trimmedName = fullName?.trim();

  if (trimmedName) return trimmedName.split(/\s+/)[0];
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
    // TODO: Connect this to the document upload flow when landing attachments are supported.
  };

  const handleMicrophoneClick = () => {
    // TODO: Connect this to voice input when speech capture is supported.
  };

  const recentConversations = conversations.slice(0, 3);

  return (
    <Box
      component="main"
      sx={{
        minHeight: "100vh",
        bgcolor: dashboardTokens.shell,
        color: dashboardTokens.text,
      }}
    >
      <Stack
        component="header"
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{
          height: 56,
          px: { xs: 1.5, sm: 3, lg: 5 },
          bgcolor: dashboardTokens.sidebar,
          borderBottom: "1px solid",
          borderColor: dashboardTokens.border,
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1}>
          <IconButton
            aria-label="Open past chats"
            size="small"
            onClick={() => setHistoryOpen(true)}
            sx={{
              width: 34,
              height: 34,
              borderRadius: `${dashboardTokens.radiusSm}px`,
              color: dashboardTokens.textMuted,
              "&:hover": {
                color: dashboardTokens.text,
                bgcolor: dashboardTokens.surfaceAlt,
              },
            }}
          >
            <MenuRoundedIcon fontSize="small" />
          </IconButton>
          <Typography
            component="span"
            sx={{
              fontSize: 20,
              fontWeight: 650,
              letterSpacing: "-0.02em",
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
          maxWidth: dashboardTokens.contentMaxWidth,
          mx: "auto",
          px: { xs: 2, sm: 4, lg: 6 },
          py: { xs: 4, sm: 5, lg: 6 },
        }}
      >
        <Box>
          <Typography
            component="h1"
            sx={{
              fontSize: { xs: 28, sm: 34 },
              lineHeight: 1.2,
              fontWeight: 600,
              letterSpacing: "-0.025em",
            }}
          >
            Hello, {firstName}
          </Typography>
          <Typography
            component="p"
            sx={{
              mt: 0.75,
              color: dashboardTokens.textMuted,
              fontSize: { xs: 18, sm: 20 },
              lineHeight: 1.4,
              fontWeight: 400,
            }}
          >
            What would you like to work on?
          </Typography>
        </Box>

        <Box sx={{ mt: 3 }}>
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
              borderColor: dashboardTokens.borderInput,
              bgcolor: dashboardTokens.surface,
              transition: "border-color 140ms ease, box-shadow 140ms ease",
              "&:focus-within": {
                borderColor: dashboardTokens.accent,
                boxShadow: "0 0 0 3px rgba(79, 125, 243, 0.12)",
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
                color: dashboardTokens.text,
                fontSize: 14,
                "& input::placeholder": {
                  color: dashboardTokens.textSubtle,
                  opacity: 1,
                },
              }}
            />
            <IconButton
              type="button"
              aria-label="Attach a file"
              onClick={handleAttachmentClick}
              sx={composerControlSx}
            >
              <AttachFileRoundedIcon fontSize="small" />
            </IconButton>
            <IconButton
              type="button"
              aria-label="Start voice input"
              onClick={handleMicrophoneClick}
              sx={composerControlSx}
            >
              <MicRoundedIcon fontSize="small" />
            </IconButton>
            <IconButton
              type="submit"
              aria-label="Send message"
              disabled={!message.trim()}
              sx={{
                width: 36,
                height: 36,
                borderRadius: `${dashboardTokens.radiusSm}px`,
                color: dashboardTokens.text,
                bgcolor: message.trim()
                  ? dashboardTokens.accent
                  : dashboardTokens.surfaceAlt,
                "&:hover": {
                  bgcolor: message.trim()
                    ? dashboardTokens.accentHover
                    : dashboardTokens.surfaceAlt,
                },
                "&.Mui-disabled": { color: dashboardTokens.textSubtle },
              }}
            >
              <SendRoundedIcon fontSize="small" />
            </IconButton>
          </Box>
          <Typography
            sx={{ mt: 1, color: dashboardTokens.textSubtle, fontSize: 12 }}
          >
            AI-BOSS provides financial insights. Review important decisions before acting.
          </Typography>
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
              const href = action.href;

              return (
                <Box
                  key={action.title}
                  role={href ? "button" : undefined}
                  tabIndex={href ? 0 : undefined}
                  onClick={href ? () => router.push(href) : undefined}
                  onKeyDown={
                    href
                      ? (event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            router.push(href);
                          }
                        }
                      : undefined
                  }
                  sx={{
                    minHeight: 142,
                    p: 2.5,
                    borderRadius: `${dashboardTokens.radiusMd}px`,
                    border: "1px solid",
                    borderColor: dashboardTokens.border,
                    bgcolor: dashboardTokens.surface,
                    cursor: href ? "pointer" : "default",
                    transition: "background-color 140ms ease, border-color 140ms ease, transform 140ms ease",
                    "&:hover": {
                      bgcolor: dashboardTokens.surfaceAlt,
                      borderColor: dashboardTokens.borderMuted,
                      transform: "translateY(-1px)",
                    },
                  }}
                >
                  <Icon sx={{ fontSize: 22, color: dashboardTokens.textMuted }} />
                  <Typography sx={{ mt: 1.75, fontSize: 16, fontWeight: 600 }}>
                    {action.title}
                  </Typography>
                  <Typography
                    sx={{ mt: 0.5, color: dashboardTokens.textMuted, fontSize: 14, lineHeight: 1.45 }}
                  >
                    {action.description}
                  </Typography>
                  <Typography sx={{ mt: 1, color: dashboardTokens.textSubtle, fontSize: 12 }}>
                    {action.meta}
                  </Typography>
                </Box>
              );
            })}
          </Box>
        </Box>

        {!historyLoading && recentConversations.length > 0 ? (
          <Box component="section" sx={{ mt: 4 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Typography component="h2" sx={{ fontSize: 15, fontWeight: 600 }}>
                Recent conversations
              </Typography>
              <Button
                size="small"
                onClick={() => setHistoryOpen(true)}
                sx={{ color: dashboardTokens.textMuted, textTransform: "none", fontSize: 13 }}
              >
                View all
              </Button>
            </Stack>
            <List
              disablePadding
              sx={{ mt: 1, borderTop: "1px solid", borderColor: dashboardTokens.border }}
            >
              {recentConversations.map((conversation) => (
                <ListItem key={conversation.id} disablePadding>
                  <ListItemButton
                    onClick={() => openConversation(conversation.id)}
                    sx={{
                      px: 0,
                      py: 1.25,
                      borderBottom: "1px solid",
                      borderColor: dashboardTokens.border,
                      "&:hover": { bgcolor: "transparent" },
                      "&:hover .conversation-title": { color: dashboardTokens.accentHover },
                    }}
                  >
                    <ListItemText
                      primary={conversation.title ?? "Untitled conversation"}
                      secondary={formatConversationDate(conversation.updated_at)}
                      primaryTypographyProps={{
                        className: "conversation-title",
                        color: dashboardTokens.textSoft,
                        fontSize: 14,
                        fontWeight: 500,
                      }}
                      secondaryTypographyProps={{
                        color: dashboardTokens.textSubtle,
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
  color: dashboardTokens.textMuted,
  "&:hover": {
    color: dashboardTokens.text,
    bgcolor: dashboardTokens.surfaceAlt,
  },
};
