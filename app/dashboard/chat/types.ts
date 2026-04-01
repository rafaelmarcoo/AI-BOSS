import type { ChatMessageStatus, ChatRole } from "./ChatMessage";
import type { Conversation } from "@/types/database";

export interface ChatRecord {
  id: string;
  role: ChatRole;
  content: string;
  status?: ChatMessageStatus;
}

export interface ChatApiMessage {
  role: ChatRole;
  content: string;
}

export interface ChatApiResponse {
  success: boolean;
  data?: {
    conversationId: string;
    message: ChatApiMessage;
    conversation: ChatApiMessage[];
  };
  error?: {
    message?: string;
  };
}

export type ChatConversationSummary = Pick<
  Conversation,
  "id" | "title" | "created_at" | "updated_at"
>;

export interface ConversationsApiResponse {
  success: boolean;
  data?: {
    conversations: ChatConversationSummary[];
  };
  error?: {
    message?: string;
  };
}

export interface ConversationDetailApiResponse {
  success: boolean;
  data?: {
    conversationId: string;
    conversation: ChatApiMessage[];
  };
  error?: {
    message?: string;
  };
}

export interface ConversationMutationApiResponse {
  success: boolean;
  data?: {
    conversation?: ChatConversationSummary;
    deleted?: boolean;
    conversationId?: string;
  };
  error?: {
    message?: string;
  };
}

export interface ChatErrorState {
  message: string;
  failedMessageId: string | null;
}
