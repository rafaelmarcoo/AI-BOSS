import { Box, Paper, Stack } from "@mui/material";
import { keyframes } from "@mui/system";
import ReactMarkdown from "react-markdown";
import { dashboardTokens } from "@/app/theme";


const assistantMarkdownSx = {
  "& *": { boxSizing: "border-box" },
  "& p": { m: 0, lineHeight: 1.45 },
  "& p + p": { mt: 0.75 },
  "& ul, & ol": { pl: 2.25, my: 0.5 },
  "& li": { my: 0.25, lineHeight: 1.45 },
  "& li > p": { m: 0 },
  "& strong": { fontWeight: 700 },
  "& h1, & h2, & h3, & h4": {
    fontSize: "0.98em",
    lineHeight: 1.35,
    fontWeight: 700,
    mt: 0.75,
    mb: 0.35,
  },
  "& h1:first-child, & h2:first-child, & h3:first-child, & h4:first-child": {
    mt: 0,
  },
};

export type ChatRole = "user" | "assistant";
export type ChatMessageStatus = "failed";

interface ChatMessageProps {
  role: ChatRole;
  content?: string;
  isLoading?: boolean;
  status?: ChatMessageStatus;
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
  status,
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
          wordBreak: "break-word",
          lineHeight: 1.45,
          whiteSpace: isUser ? "pre-wrap" : "normal",
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
          <Stack spacing={0.75}>
            {isUser ? (
              <Box sx={{ whiteSpace: "pre-wrap" }}>{content}</Box>
            ) : (
              <Box sx={assistantMarkdownSx}>
                <ReactMarkdown>
                  {(content ?? "").replace(/\n{3,}/g, "\n\n")}
                </ReactMarkdown>
              </Box>
            )}
            {status === "failed" ? (
              <Box
                component="span"
                sx={{
                  fontSize: 12,
                  color: "rgba(255,255,255,0.78)",
                }}
              >
                Failed to send
              </Box>
            ) : null}
          </Stack>
        )}
      </Paper>
    </Box>
  );
}
