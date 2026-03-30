"use client";

import { useState } from "react";
import type {
  ChatApiMessage,
  ChatApiResponse,
  ChatErrorState,
  ChatRecord,
} from "./types";

function createChatId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function mapApiConversationToRecords(messages: ChatApiMessage[]): ChatRecord[] {
  return messages.map((message) => ({
    id: createChatId(),
    role: message.role,
    content: message.content,
  }));
}

export function useChatConversation() {
  const [conversationMessages, setConversationMessages] = useState<ChatRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ChatErrorState | null>(null);

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
      const failedMessageId = nextConversation[nextConversation.length - 1]?.id ?? null;

      setError({
        message:
          requestError instanceof Error
            ? requestError.message
            : "AI-BOSS could not respond right now.",
        failedMessageId,
      });

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

  const retryMessage = async () => {
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

  return {
    conversationMessages,
    loading,
    error,
    sendMessage,
    retryMessage,
  };
}
