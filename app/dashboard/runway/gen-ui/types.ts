export type AskChatbotMode = "selection" | "prompt";

export interface GenUiWidgetInteractionProps {
  onAskChatbot: (text: string, mode?: AskChatbotMode) => void;
}

