import { createTheme } from "@mui/material/styles";

const fontFamily = 'var(--font-manrope), Manrope, "Segoe UI", sans-serif';

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
  textSubtle: "#8993A1",
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
    mode: "dark",
    primary: {
      main: dashboardTokens.accent,
      light: dashboardTokens.accentHover,
    },
    background: {
      default: dashboardTokens.shell,
      paper: dashboardTokens.surface,
    },
    text: {
      primary: dashboardTokens.text,
      secondary: dashboardTokens.textMuted,
    },
    divider: dashboardTokens.border,
    action: {
      active: dashboardTokens.textMuted,
      hover: "rgba(255, 255, 255, 0.06)",
      selected: "rgba(79, 125, 243, 0.16)",
      disabled: dashboardTokens.textSubtle,
      disabledBackground: "rgba(255, 255, 255, 0.04)",
    },
  },
  shape: {
    borderRadius: dashboardTokens.radiusMd,
  },
  typography: {
    fontFamily,
    allVariants: {
      fontFamily,
    },
    h1: {
      fontWeight: 650,
      letterSpacing: "-0.03em",
    },
    h2: {
      fontWeight: 650,
      letterSpacing: "-0.027em",
    },
    h3: {
      fontWeight: 650,
      letterSpacing: "-0.024em",
    },
    h4: {
      fontWeight: 650,
      letterSpacing: "-0.02em",
    },
    h5: {
      fontWeight: 650,
      letterSpacing: "-0.016em",
    },
    h6: {
      fontWeight: 650,
      letterSpacing: "-0.012em",
    },
    body1: {
      fontWeight: 400,
      lineHeight: 1.55,
    },
    body2: {
      fontWeight: 400,
      lineHeight: 1.5,
    },
    button: {
      fontWeight: 600,
      letterSpacing: "-0.005em",
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: dashboardTokens.shell,
          color: dashboardTokens.text,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
          color: dashboardTokens.text,
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          backgroundColor: dashboardTokens.surfaceAlt,
          color: dashboardTokens.text,
          "& .MuiOutlinedInput-notchedOutline": {
            borderColor: dashboardTokens.borderInput,
          },
          "&:hover .MuiOutlinedInput-notchedOutline": {
            borderColor: dashboardTokens.borderSoft,
          },
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
            borderColor: dashboardTokens.accent,
            borderWidth: 1,
          },
          "&.Mui-disabled": {
            backgroundColor: "rgba(255, 255, 255, 0.025)",
            color: dashboardTokens.textMuted,
          },
          "&.Mui-disabled .MuiOutlinedInput-notchedOutline": {
            borderColor: dashboardTokens.border,
          },
        },
        input: {
          color: dashboardTokens.text,
          "&::placeholder": {
            color: dashboardTokens.textSubtle,
            opacity: 1,
          },
          "&.Mui-disabled": {
            WebkitTextFillColor: dashboardTokens.textMuted,
          },
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          color: dashboardTokens.textMuted,
          "&.Mui-focused": { color: dashboardTokens.accentHover },
          "&.Mui-disabled": { color: dashboardTokens.textSubtle },
        },
      },
    },
    MuiFormHelperText: {
      styleOverrides: {
        root: { color: dashboardTokens.textMuted },
      },
    },
    MuiSelect: {
      styleOverrides: {
        select: { color: dashboardTokens.text },
        icon: { color: dashboardTokens.textMuted },
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: {
          backgroundColor: dashboardTokens.surfaceAlt,
          color: dashboardTokens.text,
          border: `1px solid ${dashboardTokens.border}`,
        },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          color: dashboardTokens.text,
          "&.Mui-selected": {
            backgroundColor: "rgba(79, 125, 243, 0.18)",
          },
          "&.Mui-selected:hover": {
            backgroundColor: "rgba(79, 125, 243, 0.24)",
          },
        },
      },
    },
    MuiAccordion: {
      styleOverrides: {
        root: {
          backgroundColor: dashboardTokens.surface,
          backgroundImage: "none",
          color: dashboardTokens.text,
        },
      },
    },
    MuiAccordionSummary: {
      styleOverrides: {
        expandIconWrapper: { color: dashboardTokens.textMuted },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          color: dashboardTokens.text,
          borderColor: dashboardTokens.border,
        },
        head: {
          color: dashboardTokens.textSoft,
          fontWeight: 700,
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          backgroundColor: dashboardTokens.surface,
          color: dashboardTokens.text,
          backgroundImage: "none",
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          fontWeight: 600,
          textTransform: "none",
        },
      },
    },
  },
});
