import { Box, Paper, Stack } from "@mui/material";
import { keyframes } from "@mui/system";
import { dashboardTokens } from "@/app/theme";

export type ChatRole = "user" | "assistant";

interface ChatMessageProps {
  role: ChatRole;
  content?: string;
  isLoading?: boolean;
}

const typing = keyframes`
  0%, 80%, 100% {
    opacity: 0.3;
    transform: translateY(0);
  }
  40% {
    opacity: 1;
    transform: translateY(-2px);
  }
`;

export function ChatMessage({
  role,
  content,
  isLoading = false,
}: ChatMessageProps) {
  const isUser = role === "user";

  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: isUser ? "flex-end" : "flex-start",
      }}
    >
      <Paper
        elevation={0}
        sx={{
          px: 2,
          py: 1.5,
          maxWidth: "85%",
          borderRadius: 2,
          border: "1px solid",
          borderColor: dashboardTokens.border,
          bgcolor: isUser ? "#2563eb" : "#4b5563",
          color: "common.white",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          lineHeight: 1.45,
        }}
      >
        {isLoading ? (
          <Stack
            direction="row"
            spacing={0.75}
            alignItems="center"
            sx={{ py: 0.25 }}
          >
            {[0, 1, 2].map((index) => (
              <Box
                key={index}
                sx={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  bgcolor: "rgba(255,255,255,0.88)",
                  animation: `${typing} 1.1s ease-in-out infinite`,
                  animationDelay: `${index * 0.14}s`,
                }}
              />
            ))}
          </Stack>
        ) : (
          content
        )}
      </Paper>
    </Box>
  );
}
