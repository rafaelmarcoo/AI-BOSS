"use client";

import { useEffect, useRef } from "react";
import {
  Alert,
  Box,
  Button,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import MenuRoundedIcon from "@mui/icons-material/MenuRounded";
import { ChatInput } from "./ChatInput";
import { ChatMessage } from "./ChatMessage";
import type {
  ChatErrorState,
  ChatRecord,
} from "./types";
import { dashboardTokens } from "@/app/theme";
import type {
  ConversationVisibility,
  UserType,
} from "@/types/database";

interface ChatContainerProps {
  fullName: string | null;
  email: string;
  userType: UserType | null;
  activeConversationTitle: string | null;
  readOnly: boolean;
  visibility: ConversationVisibility;
  visibilityLocked: boolean;
  onVisibilityChange: (visibility: ConversationVisibility) => void;
  conversationMessages: ChatRecord[];
  historyLoading: boolean;
  loading: boolean;
  uploading: boolean;
  error: ChatErrorState | null;
  onOpenHistory: () => void;
  onSendMessage: (input: string) => Promise<void>;
  onUploadDocument: (file: File) => Promise<void>;
  onRetryMessage: () => Promise<void>;
}

function createStarterMessages(fullName: string | null, email: string): ChatRecord[] {
  return [
    {
      id: "welcome",
      role: "assistant",
      content: `Hi ${fullName ?? email}. I can help you understand your current financial position.`,
    },
  ];
}

export function ChatContainer({
  fullName,
  email,
  userType,
  activeConversationTitle,
  readOnly,
  visibility,
  visibilityLocked,
  onVisibilityChange,
  conversationMessages,
  historyLoading,
  loading,
  uploading,
  error,
  onOpenHistory,
  onSendMessage,
  onUploadDocument,
  onRetryMessage,
}: ChatContainerProps) {
  const starterMessages = createStarterMessages(fullName, email);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const messages =
    conversationMessages.length === 0 ? starterMessages : conversationMessages;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [conversationMessages, fullName, email, loading]);

  return (
    <Box
      sx={{
        flex: "1 1 0",
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        bgcolor: dashboardTokens.sidebar,
      }}
    >
      <Box
        sx={{
          flex: "1 1 0",
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <Box
          sx={{
            px: 1.5,
            py: 1.1,
            borderBottom: "1px solid",
            borderBottomColor: dashboardTokens.border,
            bgcolor: dashboardTokens.sidebar,
          }}
        >
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <IconButton
              onClick={onOpenHistory}
              size="small"
              sx={{ color: dashboardTokens.textMuted, "&:hover": { bgcolor: dashboardTokens.surfaceAlt, color: dashboardTokens.text } }}
            >
              <MenuRoundedIcon />
            </IconButton>
            <Stack
              spacing={0.15}
              sx={{ flex: 1, minWidth: 0, alignItems: "flex-end", pr: 0.5 }}
            >
              <Tooltip title={activeConversationTitle ?? "New conversation"}>
                <Typography
                  variant="body2"
                  sx={{
                    color: dashboardTokens.text,
                    fontWeight: 600,
                    maxWidth: "100%",
                    textOverflow: "ellipsis",
                    overflow: "hidden",
                    whiteSpace: "nowrap",
                  }}
                >
                  {activeConversationTitle ?? "New conversation"}
                </Typography>
              </Tooltip>
              <Typography variant="caption" sx={{ color: dashboardTokens.textMuted }}>
                {readOnly ? "Company chat · Read only" : "AI-BOSS chat"}
              </Typography>
            </Stack>
          </Stack>
        </Box>

        <Box
          sx={{
            flex: "1 1 0",
            minHeight: 0,
            overflow: "auto",
            px: 1.5,
            py: 1.5,
          }}
        >
          {historyLoading ? (
            <Stack sx={{ minHeight: "100%", justifyContent: "center" }}>
              <Typography variant="body2" sx={{ color: dashboardTokens.textMuted }}>
                Loading your latest conversation...
              </Typography>
            </Stack>
          ) : conversationMessages.length === 0 ? (
            <Stack spacing={2.5} sx={{ minHeight: "100%", justifyContent: "center" }}>
              <Stack spacing={1.25} sx={{ maxWidth: 360, color: "common.white", px: 1 }}>
                <Typography variant="h6" fontWeight={600}>
                  {starterMessages[0]?.content}
                </Typography>
                <Typography variant="body2" sx={{ color: dashboardTokens.textMuted }}>
                  Try asking about runway, cash flow, burn rate, policy rules, or uploaded documents.
                </Typography>
              </Stack>
            </Stack>
          ) : (
            <Stack spacing={1} sx={{ pb: 1 }}>
              {error ? (
                <Alert
                  severity="error"
                  sx={{ alignSelf: "stretch" }}
                  action={
                    error.failedMessageId ? (
                      <Button color="inherit" size="small" onClick={() => void onRetryMessage()}>
                        Retry
                      </Button>
                    ) : null
                  }
                >
                  {error.message}
                </Alert>
              ) : null}
              {messages.map((message) => (
                <ChatMessage
                  key={message.id}
                  role={message.role}
                  content={message.content}
                  status={message.status}
                />
              ))}
              {loading ? <ChatMessage role="assistant" isLoading /> : null}
              <Box ref={bottomRef} />
            </Stack>
          )}
        </Box>

        <Box
          sx={{
            flex: "0 0 auto",
            px: 1.5,
            py: 1.25,
            borderTop: "1px solid",
            borderTopColor: dashboardTokens.border,
            bgcolor: dashboardTokens.sidebar,
          }}
        >
          {readOnly ? (
            <Alert severity="info" sx={{ borderRadius: 2 }}>
              This conversation belongs to a coworker. You can read it, but only
              its owner can continue or manage it.
            </Alert>
          ) : (
            <ChatInput
              onSend={(value) => void onSendMessage(value)}
              onUploadDocument={onUploadDocument}
              userType={userType}
              visibility={visibility}
              visibilityDisabled={visibilityLocked}
              onVisibilityChange={onVisibilityChange}
              disabled={loading}
              uploadDisabled={uploading}
            />
          )}
        </Box>
      </Box>
    </Box>
  );
}
