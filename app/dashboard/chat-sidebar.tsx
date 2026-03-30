import { Box, Divider, Paper, Stack, Typography } from "@mui/material";
import { dashboardTokens } from "@/app/theme";
import { ChatContainer } from "./chat/ChatContainer";

interface ChatSidebarProps {
  fullName: string | null;
  email: string;
}

export function ChatSidebar({ fullName, email }: ChatSidebarProps) {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        borderRight: { md: "1px solid" },
        borderRightColor: { md: dashboardTokens.border },
        bgcolor: dashboardTokens.sidebarV2,
      }}
    >
      <Box sx={{ p: 3 }}>
        <Stack spacing={0.5}>
          <Typography
            variant="h5"
            component="h1"
            fontWeight={700}
            color="common.white"
          >
            AI-BOSS
          </Typography>
          <Typography variant="body2" sx={{ color: dashboardTokens.textMuted }}>
            Financial intelligence assistant
          </Typography>
        </Stack>
      </Box>

      <Divider sx={{ borderColor: dashboardTokens.border }} />

      <Box
        sx={{ p: 3, flex: 1, display: "flex", flexDirection: "column", gap: 2 }}
      >
        <Paper
          elevation={0}
          sx={{
            p: 2.5,
            borderRadius: 1,
            bgcolor: dashboardTokens.surfaceSoft,
            border: "1px solid",
            borderColor: dashboardTokens.border,
            color: "common.white",
          }}
        >
          <Stack spacing={2}>
            <Typography variant="subtitle1" fontWeight={600}>
              Welcome, {fullName ?? email}
            </Typography>
            <Typography
              variant="body2"
              sx={{ color: dashboardTokens.textSoft }}
            >
              Ask AI-BOSS about runway, burn rates, or scenario planning.
            </Typography>
          </Stack>
        </Paper>

        <ChatContainer fullName={fullName} email={email} />
      </Box>
    </Box>
  );
}
