import {
  Box,
  Button,
  Divider,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { dashboardTokens } from "@/app/theme";

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

        <Box sx={{ flex: 1, overflow: "auto" }}>
          <Stack spacing={2}>
            <Paper
              elevation={0}
              sx={{
                p: 2,
                borderRadius: 1,
                bgcolor: dashboardTokens.surfaceAlt,
                color: "common.white",
                border: "1px solid",
                borderColor: dashboardTokens.border,
              }}
            >
              <Typography
                variant="body2"
                sx={{ color: dashboardTokens.textSoft }}
              >
                Hi {fullName ?? "there"} - I can help you understand your
                current financial position.
              </Typography>
            </Paper>
            <Paper
              elevation={0}
              sx={{
                p: 2,
                borderRadius: 1,
                bgcolor: dashboardTokens.surfaceAlt,
                color: "common.white",
                border: "1px solid",
                borderColor: dashboardTokens.border,
              }}
            >
              <Typography
                variant="body2"
                sx={{ color: dashboardTokens.textSoft }}
              >
                Try asking: &quot;What is our runway if revenue stays
                flat?&quot;
              </Typography>
            </Paper>
          </Stack>
        </Box>

        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {["Runway", "Burn", "Scenario"].map((label) => (
            <Button
              key={label}
              size="small"
              variant="outlined"
              sx={{
                color: "common.white",
                backgroundColor: dashboardTokens.surface,
                borderColor: dashboardTokens.borderSoft,
                borderRadius: 1,
              }}
            >
              {label}
            </Button>
          ))}
        </Stack>

        <Box sx={{ pt: 1 }}>
          <TextField
            fullWidth
            placeholder="Ask AI-BOSS something..."
            variant="outlined"
            size="small"
            sx={{
              "& .MuiOutlinedInput-root": {
                borderRadius: 999,
                bgcolor: dashboardTokens.surfaceAlt,
                color: "common.white",
              },
              "& .MuiOutlinedInput-notchedOutline": {
                borderColor: dashboardTokens.borderInput,
              },
              "& input": { color: "common.white" },
            }}
          />
        </Box>
      </Box>
    </Box>
  );
}
