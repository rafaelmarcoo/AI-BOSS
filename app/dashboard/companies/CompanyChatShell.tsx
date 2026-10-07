"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { Box, Chip, Grow, IconButton, Paper, Stack, Typography } from "@mui/material";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import KeyboardArrowDownRoundedIcon from "@mui/icons-material/KeyboardArrowDownRounded";
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
  const [greetingDismissed, setGreetingDismissed] = useState(false);
  const [companiesOnScreen, setCompaniesOnScreen] = useState<string[]>([]);
  const [asked, setAsked] = useState<string[]>([]);
  const [pendingPrompt, setPendingPrompt] = useState<{ id: string; text: string } | null>(null);

  const remember = useCallback((question: string) => setAsked((current) => [...current, question]), []);

  const ask = useCallback(
    (question: string) => {
      remember(question);
      setPendingPrompt({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, text: question });
      setOpen(true);
    },
    [remember],
  );

  const openChat = () => {
    setGreetingDismissed(true);
    setOpen(true);
  };

  const askAboutSelection = (selection: string) => ask(companyChatQuestion(selection, companiesOnScreen));

  const chat = useMemo(() => ({ setCompanies: setCompaniesOnScreen, ask }), [ask]);
  const suggestions = companyChatSuggestions(companiesOnScreen, asked);
  const subject = companiesOnScreen.length >= 2 ? `${companiesOnScreen[0]} and ${companiesOnScreen[1]}` : "these companies";

  return (
    <CompanyChatContext.Provider value={chat}>
      <SelectableRunwayWorkspace onAskChatbot={askAboutSelection}>{children}</SelectableRunwayWorkspace>

      <Box className="no-print">
        {!open && !greetingDismissed ? (
          <Paper
            elevation={0}
            sx={{
              position: "fixed",
              right: { xs: 16, sm: 24 },
              bottom: { xs: 88, sm: 100 },
              zIndex: 1200,
              maxWidth: 260,
              p: 1.5,
              pr: 4,
              borderRadius: 3,
              borderBottomRightRadius: 4,
              bgcolor: dashboardTokens.surface,
              border: "1px solid",
              borderColor: dashboardTokens.border,
              boxShadow: "0 12px 32px rgba(0,0,0,0.45)",
            }}
          >
            <Box component="button" type="button" onClick={openChat} sx={{ all: "unset", cursor: "pointer", display: "block" }}>
              <Typography variant="body2" fontWeight={700} color="common.white">Hi! 👋</Typography>
              <Typography variant="body2" sx={{ color: dashboardTokens.textSoft }}>
                Ask me about {subject}, or highlight any figure.
              </Typography>
            </Box>
            <IconButton
              aria-label="Dismiss greeting"
              size="small"
              onClick={() => setGreetingDismissed(true)}
              sx={{ position: "absolute", top: 4, right: 4, color: dashboardTokens.textMuted }}
            >
              <CloseRoundedIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Paper>
        ) : null}

        <IconButton
          aria-label={open ? "Minimise chat" : "Ask AI-BOSS"}
          onClick={() => (open ? setOpen(false) : openChat())}
          sx={{
            position: "fixed",
            right: { xs: 16, sm: 24 },
            bottom: { xs: 16, sm: 24 },
            zIndex: 1201,
            width: 60,
            height: 60,
            background: AI_GRADIENT,
            color: "common.white",
            boxShadow: "0 10px 28px rgba(79,125,243,0.4), 0 0 0 1px rgba(255,255,255,0.1) inset",
            transition: "transform 160ms ease, box-shadow 160ms ease",
            "&:hover": {
              background: AI_GRADIENT,
              transform: "translateY(-2px) scale(1.04)",
              boxShadow: "0 14px 34px rgba(139,92,246,0.5), 0 0 0 1px rgba(255,255,255,0.14) inset",
            },
          }}
        >
          {open ? <KeyboardArrowDownRoundedIcon sx={{ fontSize: 30 }} /> : <AutoAwesomeRoundedIcon sx={{ fontSize: 28 }} />}
        </IconButton>

        <Grow in={open} style={{ transformOrigin: "bottom right" }}>
          <Paper
            elevation={0}
            sx={{
              position: "fixed",
              zIndex: 1200,
              right: { xs: 0, sm: 24 },
              bottom: { xs: 0, sm: 100 },
              top: { xs: 0, sm: "auto" },
              left: { xs: 0, sm: "auto" },
              width: { xs: "100%", sm: 420 },
              height: { xs: "100%", sm: "min(640px, calc(100vh - 128px))" },
              borderRadius: { xs: 0, sm: 4 },
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              bgcolor: dashboardTokens.sidebar,
              border: { xs: "none", sm: "1px solid" },
              borderColor: dashboardTokens.border,
              boxShadow: "0 24px 64px rgba(0,0,0,0.55)",
            }}
          >
            <Box sx={{ px: 2, pt: 1.75, pb: 1.5, background: "linear-gradient(180deg, rgba(79,125,243,0.16) 0%, rgba(139,92,246,0.06) 100%)", borderBottom: "1px solid", borderBottomColor: dashboardTokens.border }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Stack direction="row" spacing={1.25} alignItems="center">
                  <Box sx={{ position: "relative", width: 38, height: 38, borderRadius: "50%", display: "grid", placeItems: "center", background: AI_GRADIENT, boxShadow: "0 6px 18px rgba(79,125,243,0.35)" }}>
                    <AutoAwesomeRoundedIcon sx={{ fontSize: 20, color: "common.white" }} />
                    <Box sx={{ position: "absolute", right: 0, bottom: 0, width: 10, height: 10, borderRadius: "50%", bgcolor: "#22C55E", border: "2px solid", borderColor: dashboardTokens.sidebar }} />
                  </Box>
                  <Box>
                    <Typography fontWeight={700} color="common.white" sx={{ lineHeight: 1.2 }}>AI-BOSS</Typography>
                    <Typography variant="caption" sx={{ color: dashboardTokens.textMuted }}>Ask about {subject}</Typography>
                  </Box>
                </Stack>
                <IconButton aria-label="Close chat" size="small" onClick={() => setOpen(false)} sx={{ color: dashboardTokens.textMuted }}>
                  <CloseRoundedIcon fontSize="small" />
                </IconButton>
              </Stack>

              <Typography variant="overline" sx={{ display: "block", mt: 1.25, mb: 0.5, color: dashboardTokens.textMuted, lineHeight: 1.5 }}>
                {asked.length === 0 ? "Try asking" : "Ask next"}
              </Typography>
              <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
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
                onUserMessage={remember}
              />
            </Box>
          </Paper>
        </Grow>
      </Box>
    </CompanyChatContext.Provider>
  );
}
