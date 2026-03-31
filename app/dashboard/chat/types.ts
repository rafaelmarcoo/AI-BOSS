import type { ChatMessageStatus, ChatRole } from "./ChatMessage";

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

export interface ChatErrorState {
  message: string;
  failedMessageId: string | null;
}
