"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Box } from "@mui/material";
import { dashboardTokens } from "@/app/theme";
import { ChatSidebar } from "./chat/sidebar";
import { RunwaySection } from "./runway";
import type { CompleteFinancialMetricSet } from "@/lib/financial-data";

interface ResizablePanelsProps {
  fullName: string | null;
  email: string;
  metrics: CompleteFinancialMetricSet;
}

interface SelectionChatPrompt {
  id: string;
  text: string;
}

const MIN_CHAT_WIDTH = 280;
const MAX_CHAT_WIDTH = 720;
const DEFAULT_CHAT_WIDTH = 360;
const RESIZER_WIDTH = 12;

export function ResizablePanels({
  fullName,
  email,
  metrics,
}: ResizablePanelsProps) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [chatWidth, setChatWidth] = useState(DEFAULT_CHAT_WIDTH);
  const [isDragging, setIsDragging] = useState(false);
  const [pendingChatPrompt, setPendingChatPrompt] =
    useState<SelectionChatPrompt | null>(null);

  const handleAskChatbot = (selectionText: string) => {
    setPendingChatPrompt({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      text: `Can you explain this dashboard highlight and what it means for the business?\n\n"${selectionText}"`,
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
          md: `${chatWidth}px ${RESIZER_WIDTH}px minmax(0, 1fr)`,
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
          onDocumentsProcessed={() => router.refresh()}
          selectionPrompt={pendingChatPrompt}
          onSelectionPromptHandled={() => setPendingChatPrompt(null)}
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
          bgcolor: isDragging
            ? "rgba(255,255,255,0.08)"
            : "rgba(255,255,255,0.02)",
          transition: isDragging ? "none" : "background-color 120ms ease",
          "&:hover": {
            bgcolor: "rgba(255,255,255,0.06)",
          },
        }}
      >
        <Box
          sx={{
            width: 2,
            my: 1.5,
            borderRadius: 999,
            bgcolor: isDragging
              ? "rgba(255,255,255,0.55)"
              : "rgba(255,255,255,0.18)",
          }}
        />
      </Box>

      <Box
        sx={{
          minHeight: { xs: "80vh", md: 0 },
          flex: { xs: "0 0 auto", md: undefined },
          overflow: { xs: "visible", md: "auto" },
          bgcolor: dashboardTokens.surfaceV2,
          minWidth: 0,
        }}
      >
        <RunwaySection metrics={metrics} onAskChatbot={handleAskChatbot} />
      </Box>
    </Box>
  );
}
