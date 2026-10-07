"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { Box, Button, Chip, Drawer, IconButton, Stack, Typography } from "@mui/material";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import { dashboardTokens } from "@/app/theme";
import { companyChatQuestion, companyChatSuggestions } from "@/lib/company-analysis/chat-question";
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

// The AI-BOSS accent blue into violet: used only for the AI entry points.
const AI_GRADIENT = `linear-gradient(135deg, ${dashboardTokens.accent} 0%, #8B5CF6 100%)`;

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
  const suggestions = companyChatSuggestions(companiesOnScreen);

  return (
    <CompanyChatContext.Provider value={chat}>
      <SelectableRunwayWorkspace onAskChatbot={askAboutSelection}>{children}</SelectableRunwayWorkspace>

      {!open ? (
        <Button
          onClick={() => setOpen(true)}
          startIcon={<AutoAwesomeRoundedIcon />}
          sx={{
            position: "fixed",
            right: { xs: 16, sm: 24 },
            bottom: { xs: 16, sm: 24 },
            zIndex: 1200,
            px: 2.5,
            py: 1.25,
            borderRadius: 999,
            background: AI_GRADIENT,
            color: "common.white",
            fontWeight: 700,
            textTransform: "none",
            letterSpacing: "0.01em",
            boxShadow: "0 10px 28px rgba(79,125,243,0.35), 0 0 0 1px rgba(255,255,255,0.08) inset",
            transition: "transform 160ms ease, box-shadow 160ms ease",
            "&:hover": {
              background: AI_GRADIENT,
              transform: "translateY(-2px)",
              boxShadow: "0 14px 34px rgba(139,92,246,0.45), 0 0 0 1px rgba(255,255,255,0.12) inset",
            },
          }}
        >
          Ask AI-BOSS
        </Button>
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
              boxShadow: "-12px 0 40px rgba(0,0,0,0.45)",
              display: "flex",
              flexDirection: "column",
            },
          },
        }}
      >
        <Box sx={{ px: 2, pt: 1.75, pb: 1.5, borderBottom: "1px solid", borderBottomColor: dashboardTokens.border }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Stack direction="row" spacing={1.25} alignItems="center">
              <Box sx={{ width: 34, height: 34, borderRadius: "50%", display: "grid", placeItems: "center", background: AI_GRADIENT, boxShadow: "0 6px 18px rgba(79,125,243,0.35)" }}>
                <AutoAwesomeRoundedIcon sx={{ fontSize: 18, color: "common.white" }} />
              </Box>
              <Box>
                <Typography fontWeight={700} color="common.white" sx={{ lineHeight: 1.2 }}>AI-BOSS</Typography>
                <Typography variant="caption" sx={{ color: dashboardTokens.textMuted }}>
                  {companiesOnScreen.length >= 2 ? `Ask about ${companiesOnScreen.slice(0, 2).join(" and ")}` : "Ask about these companies"}
                </Typography>
              </Box>
            </Stack>
            <IconButton aria-label="Close chat" size="small" onClick={() => setOpen(false)} sx={{ color: dashboardTokens.textMuted }}>
              <CloseRoundedIcon fontSize="small" />
            </IconButton>
          </Stack>

          <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" sx={{ mt: 1.5 }}>
            {suggestions.map((suggestion) => (
              <Chip
                key={suggestion}
                label={suggestion}
                size="small"
                onClick={() => ask(suggestion)}
                sx={{
                  height: "auto",
                  py: 0.5,
                  "& .MuiChip-label": { whiteSpace: "normal" },
                  bgcolor: "rgba(79,125,243,0.10)",
                  color: dashboardTokens.textSoft,
                  border: "1px solid",
                  borderColor: "rgba(79,125,243,0.30)",
                  "&:hover": { bgcolor: "rgba(139,92,246,0.18)", borderColor: "rgba(139,92,246,0.5)" },
                }}
              />
            ))}
          </Stack>
        </Box>
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
