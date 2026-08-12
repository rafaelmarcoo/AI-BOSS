import type { ChatMessageStatus, ChatRole } from "./ChatMessage";
import type { Conversation, ConversationVisibility } from "@/types/database";
import type { DocumentSummary } from "@/lib/documents/types";
import type { GenUiPlan } from "@/lib/gen-ui/types";

export interface ChatRecord {
  id: string;
  role: ChatRole;
  content: string;
  ui?: GenUiPlan | null;
  status?: ChatMessageStatus;
}

export interface ChatApiMessage {
  role: ChatRole;
  content: string;
  ui?: GenUiPlan | null;
}

export interface ChatApiResponse {
  success: boolean;
  data?: {
    conversationId: string;
    message: ChatApiMessage;
    conversation: ChatApiMessage[];
    visibility: ConversationVisibility;
    ui?: GenUiPlan | null;
  };
  error?: {
    message?: string;
  };
}

export type ChatConversationSummary = Pick<
  Conversation,
  "id" | "title" | "created_at" | "updated_at"
> & {
  visibility: ConversationVisibility;
  isOwner: boolean;
};

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
    visibility: ConversationVisibility;
    isOwner: boolean;
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

export type DocumentSummaryView = DocumentSummary;

export interface DocumentsApiResponse {
  success: boolean;
  data?: {
    documents: DocumentSummaryView[];
  };
  error?: {
    message?: string;
  };
}

export interface UploadDocumentApiResponse {
  success: boolean;
  data?: {
    document: DocumentSummaryView;
  };
  error?: {
    message?: string;
  };
}
