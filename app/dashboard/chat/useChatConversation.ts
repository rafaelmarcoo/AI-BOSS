"use client";

import { useEffect, useState } from "react";
import type {
  ChatApiMessage,
  ChatApiResponse,
  ChatConversationSummary,
  ChatErrorState,
  ChatRecord,
  ConversationDetailApiResponse,
  ConversationMutationApiResponse,
  ConversationsApiResponse,
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
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ChatConversationSummary[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ChatErrorState | null>(null);

  useEffect(() => {
    async function loadConversations() {
      try {
        const response = await fetch("/api/chat/conversations");
        const payload = (await response.json()) as ConversationsApiResponse;

        if (!response.ok || !payload.success) {
          throw new Error(
            payload.error?.message ?? "Could not load conversation history."
          );
        }

        const nextConversations = payload.data?.conversations ?? [];
        setConversations(nextConversations);
      } catch {
        setConversations([]);
      } finally {
        setHistoryLoading(false);
      }
    }

    void loadConversations();
  }, []);

  const loadConversation = async (
    nextConversationId: string,
    toggleLoading = true
  ) => {
    if (toggleLoading) {
      setLoading(true);
    }

    setError(null);

    try {
      const response = await fetch(`/api/chat/conversations/${nextConversationId}`);
      const payload = (await response.json()) as ConversationDetailApiResponse;

      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(
          payload.error?.message ?? "Could not load the selected conversation."
        );
      }

      setConversationId(payload.data.conversationId);
      setConversationMessages(
        mapApiConversationToRecords(payload.data.conversation)
      );
    } catch (requestError) {
      setError({
        message:
          requestError instanceof Error
            ? requestError.message
            : "Could not load the selected conversation.",
        failedMessageId: null,
      });
    } finally {
      if (toggleLoading) {
        setLoading(false);
      }
    }
  };

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
          ...(conversationId ? { conversationId } : {}),
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

      setConversationId(payload.data.conversationId);
      setConversations((prev) => {
        const existingConversation = prev.find(
          (conversation) => conversation.id === payload.data!.conversationId
        );
        const nextTitle = existingConversation?.title
          ? existingConversation.title
          : input.length > 80
            ? `${input.slice(0, 77)}...`
            : input;
        const nextSummary = {
          id: payload.data!.conversationId,
          title: nextTitle,
          created_at:
            existingConversation?.created_at ?? new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        const existingWithoutCurrent = prev.filter(
          (conversation) => conversation.id !== nextSummary.id
        );

        return [nextSummary, ...existingWithoutCurrent];
      });

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

  const selectConversation = async (nextConversationId: string) => {
    await loadConversation(nextConversationId);
  };

  const startNewConversation = () => {
    setConversationId(null);
    setConversationMessages([]);
    setError(null);
  };

  const renameConversation = async (
    targetConversationId: string,
    title: string
  ) => {
    const response = await fetch(`/api/chat/conversations/${targetConversationId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title }),
    });
    const payload = (await response.json()) as ConversationMutationApiResponse;

    if (!response.ok || !payload.success || !payload.data?.conversation) {
      throw new Error(
        payload.error?.message ?? "Could not rename the conversation."
      );
    }

    setConversations((prev) =>
      prev.map((conversation) =>
        conversation.id === targetConversationId
          ? payload.data!.conversation!
          : conversation
      )
    );
  };

  const deleteConversation = async (targetConversationId: string) => {
    const response = await fetch(`/api/chat/conversations/${targetConversationId}`, {
      method: "DELETE",
    });
    const payload = (await response.json()) as ConversationMutationApiResponse;

    if (!response.ok || !payload.success) {
      throw new Error(
        payload.error?.message ?? "Could not delete the conversation."
      );
    }

    const nextConversations = conversations.filter(
      (conversation) => conversation.id !== targetConversationId
    );
    setConversations(nextConversations);

    if (conversationId === targetConversationId) {
      if (nextConversations.length > 0) {
        await loadConversation(nextConversations[0].id);
      } else {
        startNewConversation();
      }
    }
  };

  return {
    conversationId,
    conversationMessages,
    conversations,
    historyLoading,
    loading,
    error,
    sendMessage,
    retryMessage,
    selectConversation,
    startNewConversation,
    renameConversation,
    deleteConversation,
  };
}
