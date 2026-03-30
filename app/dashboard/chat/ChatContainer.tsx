"use client";

import { useEffect, useRef, useState } from "react";
import { Box, Stack } from "@mui/material";
import { ChatInput } from "./ChatInput";
import { ChatMessage, type ChatRole } from "./ChatMessage";

interface ChatRecord {
  id: string;
  role: ChatRole;
  content: string;
}

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
  const [conversationMessages, setConversationMessages] = useState<ChatRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messages = [...starterMessages, ...conversationMessages];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [conversationMessages, fullName, email, loading]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleSend = (input: string) => {
    const id = Date.now().toString();
    setConversationMessages((prev) => [
      ...prev,
      { id, role: "user", content: input },
    ]);
    setLoading(true);

    timerRef.current = setTimeout(() => {
      setConversationMessages((prev) => [
        ...prev,
        {
          id: `${id}-assistant`,
          role: "assistant",
          content:
            "Understood. I can break that down by runway impact, burn trend, and scenario risk once your data source is connected.",
        },
      ]);
      setLoading(false);
    }, 900);
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
          {messages.map((message) => (
            <ChatMessage
              key={message.id}
              role={message.role}
              content={message.content}
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
