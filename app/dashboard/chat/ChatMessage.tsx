import { Box, Paper, Stack } from "@mui/material";
import { keyframes } from "@mui/system";
import { dashboardTokens } from "@/app/theme";
import ReactMarkdown from "react-markdown";

const markdownSx = {
  '& *': { margin: 0, padding: 0, boxSizing: 'border-box' },
  '& p': { marginBottom: '1px', lineHeight: 1.4 },
  '& p:last-child': { marginBottom: 0 },
  '& p:empty': { display: 'none' },
  '& ul, & ol': { paddingLeft: '14px', marginBottom: '1px' },
  '& ul:last-child, & ol:last-child': { marginBottom: 0 },
  '& ul:empty, & ol:empty': { display: 'none' },
  '& li': { lineHeight: 1.4, marginBottom: 0 },
  '& li:empty': { display: 'none' },
  '& li > p': { margin: '0 !important' },
  '& li > p:empty': { display: 'none' },
  '& h1, & h2, & h3, & h4': { fontWeight: 700, fontSize: '0.95em', marginTop: '4px', marginBottom: '1px' },
  '& h1:first-child, & h2:first-child, & h3:first-child': { marginTop: 0 },
  '& strong': { fontWeight: 700 },
}

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
          <Stack spacing={0.75}>
            <Box>
              {isUser
                ? content
                : (
                  <Box sx={markdownSx}>
                    <ReactMarkdown>
                      {(content ?? '').replace(/\n{3,}/g, '\n\n')}
                    </ReactMarkdown>
                  </Box>
                )
              }
            </Box>
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
