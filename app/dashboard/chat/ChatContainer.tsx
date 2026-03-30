"use client";

import { useEffect, useRef, useState } from "react";
import { Alert, Box, Button, Stack } from "@mui/material";
import { ChatInput } from "./ChatInput";
import {
  ChatMessage,
  type ChatMessageStatus,
  type ChatRole,
} from "./ChatMessage";

interface ChatRecord {
  id: string;
  role: ChatRole;
  content: string;
  status?: ChatMessageStatus;
}

interface ChatContainerProps {
  fullName: string | null;
  email: string;
}

interface ChatApiMessage {
  role: ChatRole;
  content: string;
}

interface ChatApiResponse {
  success: boolean;
  data?: {
    message: ChatApiMessage;
    conversation: ChatApiMessage[];
  };
  error?: {
    message?: string;
  };
}

interface ChatErrorState {
  message: string;
  failedMessageId: string | null;
}

function createChatId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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

function mapApiConversationToRecords(messages: ChatApiMessage[]): ChatRecord[] {
  return messages.map((message) => ({
    id: createChatId(),
    role: message.role,
    content: message.content,
  }));
}

export function ChatContainer({ fullName, email }: ChatContainerProps) {
  const starterMessages = createStarterMessages(fullName, email);
  const [conversationMessages, setConversationMessages] = useState<ChatRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ChatErrorState | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const messages = [...starterMessages, ...conversationMessages];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [conversationMessages, fullName, email, loading]);

  const sendMessage = async (
    input: string,
    existingMessages = conversationMessages
  ) => {
    const nextConversation = [
      ...existingMessages,
      { id: createChatId(), role: "user" as const, content: input },
    ];

    setError(null);
    setConversationMessages(nextConversation);
    setLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: nextConversation.map(({ role, content }) => ({
            role,
            content,
          })),
        }),
      });

      const payload = (await response.json()) as ChatApiResponse;

      if (!response.ok || !payload.success || !payload.data?.message?.content) {
        throw new Error(
          payload.error?.message ?? "AI-BOSS could not respond right now."
        );
      }

      setConversationMessages(
        mapApiConversationToRecords(payload.data.conversation)
      );
    } catch (requestError) {
      const failedMessageId = nextConversation[nextConversation.length - 1]?.id ?? null

      setError(
        {
          message:
            requestError instanceof Error
              ? requestError.message
              : "AI-BOSS could not respond right now.",
          failedMessageId,
        }
      );
      setConversationMessages((prev) =>
        prev.map((message) =>
          message.id === failedMessageId
            ? { ...message, status: "failed" }
            : message
        )
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async (input: string) => {
    await sendMessage(input);
  };

  const handleRetry = async () => {
    if (!error?.failedMessageId) {
      return;
    }

    const failedMessage = conversationMessages.find(
      (message) => message.id === error.failedMessageId
    );

    if (!failedMessage) {
      return;
    }

    const retryConversation = conversationMessages.filter(
      (message) => message.id !== error.failedMessageId
    );

    await sendMessage(failedMessage.content, retryConversation);
  };

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
                  <Button color="inherit" size="small" onClick={handleRetry}>
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
        <ChatInput onSend={handleSend} disabled={loading} />
      </Box>
    </Box>
  );
}
