import { Box, Paper, Stack, Typography, Chip } from "@mui/material";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import UpdateIcon from "@mui/icons-material/Update";
import { dashboardTokens } from "@/app/theme";

interface Activity {
  id: string;
  type: "cash-update" | "runway-update" | "burn-rate-update" | "snapshot";
  title: string;
  description: string;
  timestamp: Date;
  value?: string;
  change?: "positive" | "negative" | "neutral";
}

// Mock recent activity data
const MOCK_ACTIVITIES: Activity[] = [
  {
    id: "1",
    type: "snapshot",
    title: "Financial snapshot captured",
    description: "April 1, 2026 snapshot from Xero",
    timestamp: new Date("2026-04-01T14:30:00"),
    value: "$100,000",
    change: "neutral",
  },
  {
    id: "2",
    type: "cash-update",
    title: "Cash balance updated",
    description: "Balance increased from account reconciliation",
    timestamp: new Date("2026-03-31T09:15:00"),
    value: "+$5,000",
    change: "positive",
  },
  {
    id: "3",
    type: "burn-rate-update",
    title: "Monthly burn rate updated",
    description: "Based on latest expense data",
    timestamp: new Date("2026-03-30T16:45:00"),
    value: "$20,000/mo",
    change: "negative",
  },
  {
    id: "4",
    type: "runway-update",
    title: "Runway recalculated",
    description: "New runway: 5 months based on current burn rate",
    timestamp: new Date("2026-03-28T11:20:00"),
    value: "5.0 months",
    change: "positive",
  },
  {
    id: "5",
    type: "snapshot",
    title: "Financial snapshot captured",
    description: "March 28, 2026 snapshot from Xero",
    timestamp: new Date("2026-03-28T08:00:00"),
    value: "$95,000",
    change: "neutral",
  },
];

// Format time difference (e.g., "2 hours ago")
function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-NZ");
}

// Get icon based on activity type
function getActivityIcon(type: Activity["type"]) {
  switch (type) {
    case "cash-update":
      return <TrendingUpIcon sx={{ fontSize: 18, color: "#00e5a0" }} />;
    case "burn-rate-update":
      return <TrendingDownIcon sx={{ fontSize: 18, color: "#ff4d6d" }} />;
    case "runway-update":
      return <UpdateIcon sx={{ fontSize: 18, color: "#4da6ff" }} />;
    default:
      return (
        <UpdateIcon sx={{ fontSize: 18, color: dashboardTokens.textMuted }} />
      );
  }
}

export function RecentActivity() {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 3,
        borderRadius: 1,
        bgcolor: dashboardTokens.runwayV2,
        color: "common.white",
        border: "1px solid",
        borderColor: dashboardTokens.border,
      }}
    >
      <Stack spacing={2}>
        {/* Header */}
        <Typography variant="h6" fontWeight={700}>
          Recent Activity
        </Typography>

        {/* Activity List */}
        <Stack spacing={1.5}>
          {MOCK_ACTIVITIES.map((activity) => (
            <Box
              key={activity.id}
              sx={{
                display: "flex",
                gap: 2,
                pb: 1.5,
                borderBottom: "1px solid",
                borderBottomColor: dashboardTokens.border,
                "&:last-child": {
                  borderBottomColor: "transparent",
                  pb: 0,
                },
              }}
            >
              {/* Icon */}
              <Box
                sx={{
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "flex-start",
                  pt: 0.5,
                }}
              >
                {getActivityIcon(activity.type)}
              </Box>

              {/* Content */}
              <Stack spacing={0.5} sx={{ flex: 1, minWidth: 0 }}>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    flexWrap: "wrap",
                  }}
                >
                  <Typography
                    variant="body2"
                    fontWeight={600}
                    sx={{
                      color: "common.white",
                      fontSize: "0.9rem",
                    }}
                  >
                    {activity.title}
                  </Typography>
                  {activity.value && (
                    <Chip
                      label={activity.value}
                      size="small"
                      sx={{
                        height: 20,
                        fontSize: "0.75rem",
                        bgcolor:
                          activity.change === "positive"
                            ? "rgba(0, 229, 160, 0.15)"
                            : activity.change === "negative"
                              ? "rgba(255, 77, 109, 0.15)"
                              : "rgba(255, 255, 255, 0.1)",
                        color:
                          activity.change === "positive"
                            ? "#00e5a0"
                            : activity.change === "negative"
                              ? "#ff4d6d"
                              : dashboardTokens.textMuted,
                      }}
                    />
                  )}
                </Box>

                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    flexWrap: "wrap",
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{
                      color: dashboardTokens.textMuted,
                      fontSize: "0.8rem",
                    }}
                  >
                    {activity.description}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{
                      color: dashboardTokens.textMuted,
                      fontSize: "0.75rem",
                      opacity: 0.7,
                    }}
                  >
                    {formatTimeAgo(activity.timestamp)}
                  </Typography>
                </Box>
              </Stack>
            </Box>
          ))}
        </Stack>
      </Stack>
    </Paper>
  );
}
