"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Box } from "@mui/material";
import { dashboardTokens } from "@/app/theme";
import { ChatSidebar } from "./chat/sidebar";
import { RunwaySection } from "./runway";
import type { GenUiPlan } from "@/lib/gen-ui/types";
import type { UserType } from "@/types/database";

interface ResizablePanelsProps {
  fullName: string | null;
  email: string;
  userType: UserType | null;
  initialConversationId?: string | null;
  initialMessage?: string | null;
}

interface SelectionChatPrompt {
  id: string;
  text: string;
}

type AskChatbotMode = "selection" | "prompt";

const MIN_CHAT_WIDTH = 300;
const MAX_CHAT_WIDTH = 620;
const RESIZER_WIDTH = 8;

export function ResizablePanels({
  fullName,
  email,
  userType,
  initialConversationId = null,
  initialMessage = null,
}: ResizablePanelsProps) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [chatWidth, setChatWidth] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [pendingChatPrompt, setPendingChatPrompt] =
    useState<SelectionChatPrompt | null>(null);
  const [genUiPlan, setGenUiPlan] = useState<GenUiPlan | null>(null);

  const handleAskChatbot = (
    text: string,
    mode: AskChatbotMode = "selection",
  ) => {
    setPendingChatPrompt({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      text:
        mode === "prompt"
          ? text
          : `Can you explain this dashboard highlight and what it means for the business?\n\n"${text}"`,
    });
  };

  useEffect(() => {
    if (!isDragging) {
      return;
    }

    function handlePointerMove(event: PointerEvent) {
      const container = containerRef.current;

      if (!container) {
        return;
      }

      const bounds = container.getBoundingClientRect();
      const nextWidth = event.clientX - bounds.left;
      const clampedWidth = Math.max(
        MIN_CHAT_WIDTH,
        Math.min(MAX_CHAT_WIDTH, nextWidth),
      );

      setChatWidth(clampedWidth);
    }

    function handlePointerUp() {
      setIsDragging(false);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [isDragging]);

  return (
    <Box
      ref={containerRef}
      sx={{
        flex: { md: "1 1 0" },
        minHeight: { md: 0 },
        display: { xs: "flex", md: "grid" },
        flexDirection: { xs: "column", md: undefined },
        gridTemplateColumns: {
          md:
            chatWidth === null
              ? `minmax(${MIN_CHAT_WIDTH}px, 1fr) ${RESIZER_WIDTH}px minmax(0, 2fr)`
              : `${chatWidth}px ${RESIZER_WIDTH}px minmax(0, 1fr)`,
        },
        overflow: { md: "hidden" },
      }}
    >
      <Box
        sx={{
          height: { xs: "70vh", md: "100%" },
          flex: { xs: "0 0 70vh", md: undefined },
          minHeight: { md: 0 },
          overflow: "hidden",
          borderBottom: { xs: "1px solid", md: "none" },
          borderBottomColor: { xs: dashboardTokens.border },
        }}
      >
        <ChatSidebar
          fullName={fullName}
          email={email}
          userType={userType}
          initialConversationId={initialConversationId}
          initialMessage={initialMessage}
          onDocumentsProcessed={() => router.refresh()}
          onInitialMessageHandled={() => {
            window.history.replaceState(null, "", "/dashboard");
          }}
          selectionPrompt={pendingChatPrompt}
          onSelectionPromptHandled={() => setPendingChatPrompt(null)}
          onGenUiPlan={setGenUiPlan}
        />
      </Box>

      <Box
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize chat panel"
        onPointerDown={() => setIsDragging(true)}
        sx={{
          display: { xs: "none", md: "flex" },
          alignItems: "stretch",
          justifyContent: "center",
          cursor: "col-resize",
          userSelect: "none",
          touchAction: "none",
          bgcolor: "transparent",
          transition: isDragging ? "none" : "background-color 120ms ease",
          "&:hover": {
            bgcolor: dashboardTokens.surfaceSoft,
          },
        }}
      >
        <Box
          sx={{
            width: 1,
            my: 0,
            bgcolor: isDragging
              ? dashboardTokens.accent
              : dashboardTokens.border,
          }}
        />
      </Box>

      <Box
        sx={{
          minHeight: { xs: "80vh", md: 0 },
          flex: { xs: "0 0 auto", md: undefined },
          overflow: { xs: "visible", md: "auto" },
          bgcolor: dashboardTokens.shell,
          minWidth: 0,
        }}
      >
        <RunwaySection
          genUiPlan={genUiPlan}
          onAskChatbot={handleAskChatbot}
        />
      </Box>
    </Box>
  );
}
