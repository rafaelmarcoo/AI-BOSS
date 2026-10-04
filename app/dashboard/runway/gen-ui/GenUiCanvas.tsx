"use client";

import { useEffect, useState } from "react";
import { Alert, Box, Button, Chip, Paper, Stack, Typography } from "@mui/material";
import { dashboardTokens } from "@/app/theme";
import type { GenUiPlan } from "@/lib/gen-ui/types";
import { GenUiWidgetRenderer } from "./GenUiWidgetRenderer";
import { DashboardLayoutWorkspace } from "./layout/DashboardLayoutWorkspace";
import type { AskChatbotMode } from "./types";

export { GenUiWidgetRenderer };

interface GenUiCanvasProps {
  plan: GenUiPlan | null;
  onAskChatbot: (text: string, mode?: AskChatbotMode) => void;
}

const EXAMPLE_PROMPTS = [
  "Plan the next 6 months from my current runway.",
  "What happens if monthly burn increases by 15%?",
  "When do I hit 3 months of runway?",
  "Which costs should I review first?",
  "Show me a future cash and runway trend.",
];

const DOCUMENT_REVIEW_PROMPTS = [
  "Why can't AI-BOSS calculate with this document yet?",
  "Which uploaded values still need review?",
  "How do I confirm extracted document values?",
];

const HISTORICAL_DOCUMENT_PROMPTS = [
  "Re-run this document question using the current review status.",
  "Calculate my current runway from User-confirmed values.",
  "Show the User-confirmed financial history for this source.",
];

export function GenUiCanvas({
  plan,
  onAskChatbot,
}: GenUiCanvasProps) {
  const hasPlan = Boolean(plan && plan.widgets.length > 0);
  const documentReviewMode = plan?.workspaceMode === "document_review";
  const snapshotKey = plan?.documentReviewSnapshot?.documentIds.join("|") ?? null;
  const [documentReviewResolution, setDocumentReviewResolution] = useState<{
    snapshotKey: string;
    status: "changed" | "confirmed";
  } | null>(null);

  useEffect(() => {
    const snapshot = plan?.documentReviewSnapshot;

    if (!documentReviewMode || !snapshot) return;

    let cancelled = false;

    void fetch("/api/documents", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return null;
        return response.json() as Promise<{
          data?: {
            documents?: Array<{
              id: string;
              financial_review_status: "legacy" | "not_required" | "pending" | "confirmed";
            }>;
          };
        }>;
      })
      .then((payload) => {
        if (cancelled || !payload) return;

        const currentStatuses = (payload.data?.documents ?? [])
          .filter((document) => snapshot.documentIds.includes(document.id))
          .map((document) => document.financial_review_status);

        if (
          currentStatuses.length === 0 ||
          currentStatuses.every((status) => status === "pending")
        ) {
          return;
        }

        setDocumentReviewResolution({
          snapshotKey: snapshot.documentIds.join("|"),
          status: currentStatuses.every(
            (status) => status === "confirmed" || status === "not_required",
          )
            ? "confirmed"
            : "changed",
        });
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [documentReviewMode, snapshotKey, plan?.documentReviewSnapshot]);

  const historicalDocumentSnapshot =
    documentReviewMode &&
    snapshotKey !== null &&
    documentReviewResolution?.snapshotKey === snapshotKey;
  const documentReviewState = historicalDocumentSnapshot
    ? documentReviewResolution.status
    : "pending";
  const examplePrompts = historicalDocumentSnapshot
    ? HISTORICAL_DOCUMENT_PROMPTS
    : documentReviewMode
      ? DOCUMENT_REVIEW_PROMPTS
      : EXAMPLE_PROMPTS;
  const workspaceTitle = historicalDocumentSnapshot
    ? "Historical document evidence"
    : documentReviewMode
      ? "Document evidence workspace"
      : "Generated workspace";
  const workspaceSummary = historicalDocumentSnapshot
    ? documentReviewState === "confirmed"
      ? "This workspace was generated before the document became User-confirmed. The earlier answer remains unchanged; ask again for current calculations."
      : "The document review status has changed since this workspace was generated. Ask again to use the current state."
    : hasPlan
      ? plan?.summary
      : "Financial context generated from your current AI-BOSS conversation.";

  return (
    <Paper
      elevation={0}
      sx={{
        p: 0,
        borderRadius: 0,
        bgcolor: "transparent",
        color: dashboardTokens.text,
        border: 0,
        boxShadow: "none",
        overflow: "hidden",
      }}
    >
      <Stack spacing={0}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          alignItems={{ xs: "flex-start", sm: "center" }}
          justifyContent="space-between"
          spacing={1}
          sx={{ pb: 2.5 }}
        >
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Box sx={{ minWidth: 0 }}>
              <Typography component="h1" sx={{ fontSize: { xs: 22, sm: 26 }, fontWeight: 600, letterSpacing: "-0.025em" }}>
                {workspaceTitle}
              </Typography>
              <Typography
                variant="body2"
                sx={{ color: dashboardTokens.textMuted }}
              >
                {historicalDocumentSnapshot || documentReviewMode
                  ? workspaceSummary
                  : hasPlan
                    ? plan?.summary
                    : "Choose a follow-up or ask AI Boss a question to generate relevant widgets."}
              </Typography>
            </Box>
          </Stack>
          {hasPlan ? (
            <Chip
              label={
                historicalDocumentSnapshot
                  ? "Historical snapshot"
                  : documentReviewMode
                    ? "Review required"
                    : "Live"
              }
              size="small"
              sx={{
                height: 24,
                color: historicalDocumentSnapshot
                  ? "#bae6fd"
                  : documentReviewMode
                    ? dashboardTokens.warning
                    : dashboardTokens.positive,
                bgcolor: historicalDocumentSnapshot
                  ? "rgba(56, 189, 248, 0.10)"
                  : documentReviewMode
                    ? "rgba(201, 129, 116, 0.10)"
                    : "rgba(62, 180, 137, 0.10)",
                borderColor: historicalDocumentSnapshot
                  ? "rgba(56, 189, 248, 0.22)"
                  : documentReviewMode
                    ? "rgba(201, 129, 116, 0.22)"
                    : "rgba(62, 180, 137, 0.22)",
                borderRadius: `${dashboardTokens.radiusSm}px`,
                fontSize: 12,
                alignSelf: { xs: "flex-start", sm: "center" },
              }}
              variant="outlined"
            />
          ) : null}
        </Stack>

        {historicalDocumentSnapshot ? (
          <Alert severity="info" sx={{ mb: 3 }}>
            This saved workspace reflects the review state at the time of the answer. It does not override the document&apos;s current status.
          </Alert>
        ) : null}

        <DashboardLayoutWorkspace
          plan={plan}
          customizationEnabled={!documentReviewMode}
          onAskChatbot={onAskChatbot}
        />

        <Stack spacing={1.25}>
          <Typography sx={{ fontSize: 16, fontWeight: 600 }}>
            Ask a follow-up
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {examplePrompts.map((prompt) => (
              <Button
                key={prompt}
                size="small"
                variant="outlined"
                onClick={() => onAskChatbot(prompt, "prompt")}
                sx={{
                  minHeight: 34,
                  borderRadius: `${dashboardTokens.radiusSm}px`,
                  color: dashboardTokens.textSoft,
                  borderColor: dashboardTokens.border,
                  bgcolor: dashboardTokens.surface,
                  textTransform: "none",
                  fontSize: 13,
                  maxWidth: { xs: "100%", sm: "none" },
                  whiteSpace: "normal",
                  textAlign: "left",
                  "&:hover": {
                    borderColor: dashboardTokens.borderMuted,
                    bgcolor: dashboardTokens.surfaceAlt,
                    color: dashboardTokens.text,
                  },
                  "&:focus-visible": {
                    outline: `2px solid ${dashboardTokens.accent}`,
                    outlineOffset: 2,
                  },
                }}
              >
                {prompt}
              </Button>
            ))}
          </Stack>
        </Stack>
      </Stack>
    </Paper>
  );
}
