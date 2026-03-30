"use client";

import { useEffect, useRef } from "react";
import { Alert, Box, Button, Stack } from "@mui/material";
import { ChatInput } from "./ChatInput";
import { ChatMessage } from "./ChatMessage";
import { useChatConversation } from "./useChatConversation";
import type { ChatRecord } from "./types";

interface ChatContainerProps {
  fullName: string | null;
  email: string;
}

function createStarterMessages(fullName: string | null, email: string): ChatRecord[] {
  return [
    {
      id: "welcome",
      role: "assistant",
      content: `Hi ${fullName ?? email} - I can help you understand your current financial position.`,
    },
    {
      id: "hint",
      role: "assistant",
      content: 'Try asking: "What is our runway if revenue stays flat?"',
    },
  ];
}

export function ChatContainer({ fullName, email }: ChatContainerProps) {
  const starterMessages = createStarterMessages(fullName, email);
  const { conversationMessages, loading, error, sendMessage, retryMessage } =
    useChatConversation();
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const messages = [...starterMessages, ...conversationMessages];

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
      }}
    >
      {/* Scrollable messages area */}
      <Box
        sx={{
          flex: "1 1 0",
          minHeight: 0,
          overflow: "auto",
          pr: 0.5,
        }}
      >
        <Stack spacing={1.25} sx={{ pb: 2 }}>
          {error ? (
            <Alert
              severity="error"
              sx={{ alignSelf: "stretch" }}
              action={
                error.failedMessageId ? (
                  <Button color="inherit" size="small" onClick={retryMessage}>
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
      </Box>

      {/* Pinned input bar */}
      <Box sx={{ flex: "0 0 auto", pt: 2 }}>
        <ChatInput onSend={sendMessage} disabled={loading} />
      </Box>
    </Box>
  );
}
