"use client";

import { useEffect, useState } from "react";
import {
  Box,
  Button,
  Divider,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { dashboardTokens } from "@/app/theme";
import { ChatContainer } from "./ChatContainer";
import { useChatConversation } from "./useChatConversation";

interface ChatSidebarProps {
  fullName: string | null;
  email: string;
}

export function ChatSidebar({ fullName, email }: ChatSidebarProps) {
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const {
    conversationId,
    conversationMessages,
    loading,
    error,
    conversations,
    historyLoading,
    sendMessage,
    retryMessage,
    selectConversation,
    startNewConversation,
  } = useChatConversation();

  useEffect(() => {
    setSelectedConversationId(conversationId);
  }, [conversationId]);

  const handleSelectConversation = async (conversationId: string) => {
    setSelectedConversationId(conversationId);
    await selectConversation(conversationId);
  };

  const handleStartNewConversation = () => {
    setSelectedConversationId(null);
    startNewConversation();
  };

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: 0,
        overflow: "hidden",
        borderRight: { md: "1px solid" },
        borderRightColor: { md: dashboardTokens.border },
        borderBottom: { xs: "1px solid", md: "none" },
        borderBottomColor: { xs: dashboardTokens.border, md: "transparent" },
        bgcolor: dashboardTokens.sidebarV2,
      }}
    >
      {/* Sidebar title — hidden on mobile to save space */}
      <Box
        sx={{ display: { xs: "none", md: "block" }, p: 3, flex: "0 0 auto" }}
      >
        <Stack spacing={0.5}>
          <Typography
            variant="h5"
            component="h1"
            fontWeight={700}
            color="common.white"
          >
            AI-BOSS
          </Typography>
          <Typography variant="body2" sx={{ color: dashboardTokens.textMuted }}>
            Financial intelligence assistant
          </Typography>
        </Stack>
      </Box>

      <Divider
        sx={{
          display: { xs: "none", md: "block" },
          borderColor: dashboardTokens.border,
        }}
      />

      {/* Body */}
      <Box
        sx={{
          p: { xs: 1.5, md: 3 },
          flex: "1 1 0",
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          gap: { xs: 1, md: 2 },
          overflow: "hidden",
        }}
      >
        {/* Welcome card — hidden on mobile to save space */}
        <Paper
          elevation={0}
          sx={{
            display: { xs: "none", md: "block" },
            p: 2.5,
            flex: "0 0 auto",
            borderRadius: 1,
            bgcolor: dashboardTokens.surfaceSoft,
            border: "1px solid",
            borderColor: dashboardTokens.border,
            color: "common.white",
          }}
        >
          <Stack spacing={2}>
            <Typography variant="subtitle1" fontWeight={600}>
              Welcome, {fullName ?? email}
            </Typography>
            <Typography
              variant="body2"
              sx={{ color: dashboardTokens.textSoft }}
            >
              Ask AI-BOSS about runway, burn rates, or scenario planning.
            </Typography>
          </Stack>
        </Paper>

        <Paper
          elevation={0}
          sx={{
            p: 2,
            flex: "0 0 auto",
            borderRadius: 1,
            bgcolor: dashboardTokens.surfaceSoft,
            border: "1px solid",
            borderColor: dashboardTokens.border,
            color: "common.white",
          }}
        >
          <Stack spacing={1.5}>
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
            >
              <Typography variant="subtitle2" fontWeight={600}>
                History
              </Typography>
              <Button
                size="small"
                variant="outlined"
                onClick={handleStartNewConversation}
                sx={{
                  borderRadius: 999,
                  color: "common.white",
                  borderColor: dashboardTokens.borderMuted,
                  fontSize: "0.75rem",
                }}
              >
                New chat
              </Button>
            </Stack>

            <Box sx={{ maxHeight: 180, overflow: "auto" }}>
              {historyLoading ? (
                <Typography variant="body2" sx={{ color: dashboardTokens.textMuted }}>
                  Loading conversations...
                </Typography>
              ) : conversations.length === 0 ? (
                <Typography variant="body2" sx={{ color: dashboardTokens.textMuted }}>
                  No saved conversations yet.
                </Typography>
              ) : (
                <List disablePadding>
                  {conversations.map((conversation) => (
                    <ListItemButton
                      key={conversation.id}
                      selected={selectedConversationId === conversation.id}
                      onClick={() => void handleSelectConversation(conversation.id)}
                      sx={{
                        px: 1.25,
                        py: 0.75,
                        borderRadius: 1,
                        alignItems: "flex-start",
                        "&.Mui-selected": {
                          bgcolor: dashboardTokens.surfaceAlt,
                        },
                      }}
                    >
                      <ListItemText
                        primary={conversation.title ?? "Untitled conversation"}
                        secondary={new Date(conversation.updated_at).toLocaleString()}
                        primaryTypographyProps={{
                          color: "common.white",
                          fontSize: 14,
                          lineHeight: 1.3,
                        }}
                        secondaryTypographyProps={{
                          color: dashboardTokens.textMuted,
                          fontSize: 12,
                        }}
                      />
                    </ListItemButton>
                  ))}
                </List>
              )}
            </Box>
          </Stack>
        </Paper>

        <ChatContainer
          fullName={fullName}
          email={email}
          conversationMessages={conversationMessages}
          loading={loading}
          error={error}
          onSendMessage={sendMessage}
          onRetryMessage={retryMessage}
        />
      </Box>
    </Box>
  );
}
