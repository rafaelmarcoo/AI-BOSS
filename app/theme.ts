import { createTheme } from "@mui/material/styles";

export const dashboardTokens = {
  shell: "#090B10",
  sidebar: "#0C0F15",
  surface: "#11151D",
  surfaceAlt: "#151A24",
  surfaceSoft: "rgba(255, 255, 255, 0.035)",
  border: "#252B36",
  borderInput: "#303744",
  borderMuted: "#343C49",
  borderSoft: "#3B4452",
  text: "#F4F6F8",
  textMuted: "#9DA7B5",
  textSoft: "#C4CBD4",
  textSubtle: "#6F7885",
  accent: "#4F7DF3",
  accentHover: "#5D88F5",
  positive: "#3EB489",
  warning: "#C98174",
  radiusSm: 8,
  radiusMd: 10,
  controlHeight: 34,
  contentMaxWidth: 1120,
  // Legacy aliases kept while the remaining dashboard surfaces are migrated.
  sidebarV2: "#0C0F15",
  surfaceV2: "#090B10",
  runwayV2: "#11151D",
};

export const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: dashboardTokens.accent,
    },
    background: {
      default: "#f8fafc",
      paper: "#ffffff",
    },
    text: {
      primary: "#0f172a",
      secondary: "#475569",
    },
  },
  shape: {
    borderRadius: dashboardTokens.radiusMd,
  },
  typography: {
    fontFamily: 'Inter, "Avenir Next", "Segoe UI", sans-serif',
  },
});
