"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { Box, Drawer, Fab, IconButton, Stack, Typography } from "@mui/material";
import ChatBubbleRoundedIcon from "@mui/icons-material/ChatBubbleRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import { dashboardTokens } from "@/app/theme";
import { companyChatQuestion } from "@/lib/company-analysis/chat-question";
import type { UserType } from "@/types/database";
import { ChatSidebar } from "../chat/sidebar";
import { SelectableRunwayWorkspace } from "../runway/selection-prompt";

interface CompanyChat {
  setCompanies: (names: string[]) => void;
  ask: (question: string) => void;
}

const CompanyChatContext = createContext<CompanyChat>({ setCompanies: () => undefined, ask: () => undefined });

export function useCompanyChat() {
  return useContext(CompanyChatContext);
}

interface CompanyChatShellProps {
  fullName: string | null;
  email: string;
  userType: UserType | null;
  children: ReactNode;
}

export function CompanyChatShell({ fullName, email, userType, children }: CompanyChatShellProps) {
  const [open, setOpen] = useState(false);
  const [companiesOnScreen, setCompaniesOnScreen] = useState<string[]>([]);
  const [pendingPrompt, setPendingPrompt] = useState<{ id: string; text: string } | null>(null);

  const ask = useCallback((question: string) => {
    setPendingPrompt({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, text: question });
    setOpen(true);
  }, []);

  const askAboutSelection = (selection: string) => ask(companyChatQuestion(selection, companiesOnScreen));

  const chat = useMemo(() => ({ setCompanies: setCompaniesOnScreen, ask }), [ask]);

  return (
    <CompanyChatContext.Provider value={chat}>
      <SelectableRunwayWorkspace onAskChatbot={askAboutSelection}>{children}</SelectableRunwayWorkspace>

      {!open ? (
        <Fab
          variant="extended"
          color="primary"
          onClick={() => setOpen(true)}
          sx={{ position: "fixed", right: { xs: 16, sm: 24 }, bottom: { xs: 16, sm: 24 }, textTransform: "none", zIndex: 1200 }}
        >
          <ChatBubbleRoundedIcon sx={{ mr: 1 }} />
          Ask AI-BOSS
        </Fab>
      ) : null}

      <Drawer
        anchor="right"
        variant="persistent"
        open={open}
        slotProps={{
          paper: {
            sx: {
              width: { xs: "100%", sm: 440 },
              height: "100vh",
              bgcolor: dashboardTokens.sidebar,
              borderLeft: "1px solid",
              borderLeftColor: dashboardTokens.border,
              display: "flex",
              flexDirection: "column",
            },
          },
        }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 1.5, py: 1, borderBottom: "1px solid", borderBottomColor: dashboardTokens.border }}>
          <Typography fontWeight={700} color="common.white">AI-BOSS chat</Typography>
          <IconButton aria-label="Close chat" size="small" onClick={() => setOpen(false)}>
            <CloseRoundedIcon fontSize="small" />
          </IconButton>
        </Stack>
        <Box sx={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
          <ChatSidebar
            fullName={fullName}
            email={email}
            userType={userType}
            selectionPrompt={pendingPrompt}
            onSelectionPromptHandled={() => setPendingPrompt(null)}
          />
        </Box>
      </Drawer>
    </CompanyChatContext.Provider>
  );
}
