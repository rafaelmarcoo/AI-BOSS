"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Box,
  CircularProgress,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import ChatBubbleOutlineRoundedIcon from "@mui/icons-material/ChatBubbleOutlineRounded";
import DescriptionRoundedIcon from "@mui/icons-material/DescriptionRounded";
import RouteRoundedIcon from "@mui/icons-material/RouteRounded";
import { dashboardTokens } from "@/app/theme";
import type {
  RecentActivityItem,
  RecentActivityKind,
} from "@/lib/activity/recent-activity";

interface RecentActivityResponse {
  success: boolean;
  data?: { activities: RecentActivityItem[] };
  error?: { message?: string };
}

function formatTimeAgo(value: string) {
  const date = new Date(value);
  const diffMs = Math.max(0, Date.now() - date.getTime());
  const minutes = Math.floor(diffMs / 60_000);
  const hours = Math.floor(diffMs / 3_600_000);
  const days = Math.floor(diffMs / 86_400_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString("en-NZ");
}

function ActivityIcon({ kind }: { kind: RecentActivityKind }) {
  if (kind === "document") return <DescriptionRoundedIcon fontSize="small" />;
  if (kind === "conversation") return <ChatBubbleOutlineRoundedIcon fontSize="small" />;
  return <RouteRoundedIcon fontSize="small" />;
}

export function RecentActivity() {
  const router = useRouter();
  const [activities, setActivities] = useState<RecentActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const response = await fetch("/api/activity");
        const payload = (await response.json()) as RecentActivityResponse;
        if (!response.ok || !payload.success || !payload.data) {
          throw new Error(payload.error?.message ?? "Could not load recent activity.");
        }
        if (active) {
          setActivities(payload.data.activities);
          setError(null);
        }
      } catch (requestError) {
        if (active) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Could not load recent activity.",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, []);

  return (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 2, sm: 2.5 },
        borderRadius: 2.5,
        bgcolor: dashboardTokens.surface,
        color: dashboardTokens.text,
        border: "1px solid",
        borderColor: dashboardTokens.border,
      }}
    >
      <Stack spacing={1.5}>
        <Stack>
          <Typography component="h2" variant="h6" fontWeight={700}>
            Recent activity
          </Typography>
          <Typography variant="body2" sx={{ color: dashboardTokens.textMuted }}>
            Your latest accessible documents, conversations, and scenarios.
          </Typography>
        </Stack>

        {loading ? (
          <Stack direction="row" spacing={1} alignItems="center">
            <CircularProgress size={18} />
            <Typography variant="body2" sx={{ color: dashboardTokens.textMuted }}>
              Loading activity…
            </Typography>
          </Stack>
        ) : null}
        {error ? <Alert severity="error">{error}</Alert> : null}
        {!loading && !error && activities.length === 0 ? (
          <Typography variant="body2" sx={{ color: dashboardTokens.textMuted }}>
            No activity yet. Upload a document, start a conversation, or save a scenario.
          </Typography>
        ) : null}

        <Stack spacing={0.75}>
          {activities.map((activity) => (
            <Box
              component="button"
              type="button"
              key={activity.id}
              onClick={() => router.push(activity.href)}
              sx={{
                display: "flex",
                width: "100%",
                gap: 1.25,
                alignItems: "flex-start",
                p: 1.25,
                border: "1px solid",
                borderColor: dashboardTokens.border,
                borderRadius: 1.75,
                bgcolor: "rgba(255,255,255,0.025)",
                color: "inherit",
                textAlign: "left",
                cursor: "pointer",
                "&:hover": {
                  bgcolor: "rgba(255,255,255,0.055)",
                  borderColor: dashboardTokens.borderSoft,
                },
                "&:focus-visible": {
                  outline: `2px solid ${dashboardTokens.accent}`,
                  outlineOffset: 2,
                },
              }}
            >
              <Box
                sx={{
                  display: "grid",
                  placeItems: "center",
                  width: 32,
                  height: 32,
                  flex: "0 0 auto",
                  borderRadius: 1.5,
                  bgcolor: "rgba(79,125,243,0.14)",
                  color: "#93c5fd",
                }}
              >
                <ActivityIcon kind={activity.kind} />
              </Box>
              <Stack sx={{ minWidth: 0, flex: 1 }}>
                <Typography variant="body2" fontWeight={700}>
                  {activity.title}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{ color: dashboardTokens.textMuted, overflowWrap: "anywhere" }}
                >
                  {activity.description}
                </Typography>
              </Stack>
              <Typography
                variant="caption"
                sx={{ color: dashboardTokens.textSubtle, whiteSpace: "nowrap" }}
              >
                {formatTimeAgo(activity.timestamp)}
              </Typography>
            </Box>
          ))}
        </Stack>
      </Stack>
    </Paper>
  );
}
