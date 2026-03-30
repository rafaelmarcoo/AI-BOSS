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

export function ChatContainer({ fullName, email }: ChatContainerProps) {
  const [messages, setMessages] = useState<ChatRecord[]>([
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
  ]);
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading]);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const handleSend = (input: string) => {
    const id = Date.now().toString();
    setMessages((prev) => [...prev, { id, role: "user", content: input }]);
    setLoading(true);

    timerRef.current = setTimeout(() => {
      setMessages((prev) => [
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
        flex: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        gap: 1.5,
      }}
    >
      <Box sx={{ flex: 1, minHeight: 0, overflow: "auto", pr: 0.5 }}>
        <Stack spacing={1.25}>
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

      <ChatInput onSend={handleSend} disabled={loading} />
    </Box>
  );
}
