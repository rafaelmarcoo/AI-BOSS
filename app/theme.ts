import { createTheme } from "@mui/material/styles";

const fontFamily = 'var(--font-poppins), Poppins, "Segoe UI", sans-serif';

export const dashboardTokens = {
  shell: "#29465F",
  sidebar: "#203A50",
  surface: "#354F66",
  surfaceAlt: "#405D74",
  surfaceSoft: "rgba(255, 255, 255, 0.065)",
  border: "rgba(255, 255, 255, 0.12)",
  borderInput: "rgba(216, 227, 236, 0.28)",
  borderMuted: "rgba(216, 227, 236, 0.38)",
  borderSoft: "rgba(216, 227, 236, 0.5)",
  text: "#FBFAF7",
  textMuted: "#B8C7D9",
  textSoft: "#D8E3EC",
  textSubtle: "#9EB3C4",
  accent: "#F28C5B",
  accentHover: "#E57D4C",
  positive: "#70C7A1",
  warning: "#F3A27B",
  radiusSm: 10,
  radiusMd: 14,
  controlHeight: 38,
  contentMaxWidth: 1120,
  // Legacy aliases kept while the remaining dashboard surfaces are migrated.
  sidebarV2: "#203A50",
  surfaceV2: "#29465F",
  runwayV2: "#354F66",
};

export const dashboardCanvasTokens = {
  shell: "#F3F1ED",
  sidebar: "#FFFFFF",
  surface: "#FFFFFF",
  surfaceAlt: "#F7F7F4",
  surfaceSoft: "rgba(22, 58, 90, 0.045)",
  border: "#E2E1DE",
  borderInput: "#C8D6E2",
  borderMuted: "#B7C9D7",
  borderSoft: "#9EB3C4",
  text: "#163A5A",
  textMuted: "#566A7F",
  textSoft: "#405D74",
  textSubtle: "#566A7F",
  accent: "#F28C5B",
  accentHover: "#E57D4C",
  positive: "#116B4D",
  warning: "#87540F",
  negative: "#A62E43",
  info: "#245F8D",
  adjusted: "#086B7A",
  radiusSm: 10,
  radiusMd: 14,
  controlHeight: 38,
  contentMaxWidth: 1120,
} as const;

export const theme = createTheme({
  palette: {
    mode: "dark",
    primary: {
      main: dashboardTokens.accent,
      light: dashboardTokens.accentHover,
      contrastText: "#163A5A",
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
      hover: "rgba(255, 255, 255, 0.08)",
      selected: "rgba(242, 140, 91, 0.18)",
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
      letterSpacing: "-0.025em",
    },
    h2: {
      fontWeight: 650,
      letterSpacing: "-0.022em",
    },
    h3: {
      fontWeight: 650,
      letterSpacing: "-0.02em",
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
            backgroundColor: "rgba(242, 140, 91, 0.18)",
          },
          "&.Mui-selected:hover": {
            backgroundColor: "rgba(242, 140, 91, 0.26)",
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
          borderRadius: dashboardTokens.radiusSm,
        },
      },
    },
  },
});

export const dashboardCanvasTheme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#9B451C",
      dark: "#843B17",
      contrastText: "#FFFFFF",
    },
    info: { main: dashboardCanvasTokens.info },
    success: { main: dashboardCanvasTokens.positive },
    warning: { main: dashboardCanvasTokens.warning },
    error: { main: dashboardCanvasTokens.negative },
    background: {
      default: dashboardCanvasTokens.shell,
      paper: dashboardCanvasTokens.surface,
    },
    text: {
      primary: dashboardCanvasTokens.text,
      secondary: dashboardCanvasTokens.textMuted,
    },
    divider: dashboardCanvasTokens.border,
    action: {
      hover: "rgba(22, 58, 90, 0.05)",
      selected: "rgba(242, 140, 91, 0.14)",
    },
  },
  shape: {
    borderRadius: dashboardCanvasTokens.radiusMd,
  },
  typography: {
    fontFamily,
    allVariants: { fontFamily },
    button: { fontWeight: 600, letterSpacing: "-0.005em" },
  },
  components: {
    MuiPaper: {
      styleOverrides: { root: { backgroundImage: "none" } },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: dashboardCanvasTokens.radiusSm,
          fontWeight: 600,
          textTransform: "none",
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          backgroundColor: dashboardCanvasTokens.surface,
          color: dashboardCanvasTokens.text,
          "& .MuiOutlinedInput-notchedOutline": {
            borderColor: dashboardCanvasTokens.borderInput,
          },
          "&:hover .MuiOutlinedInput-notchedOutline": {
            borderColor: dashboardCanvasTokens.borderMuted,
          },
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
            borderColor: dashboardCanvasTokens.accent,
          },
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          color: dashboardCanvasTokens.textMuted,
          "&.Mui-focused": { color: dashboardCanvasTokens.text },
        },
      },
    },
    MuiSelect: {
      styleOverrides: {
        select: { color: dashboardCanvasTokens.text },
        icon: { color: dashboardCanvasTokens.textMuted },
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: {
          color: dashboardCanvasTokens.text,
          backgroundColor: dashboardCanvasTokens.surface,
          border: `1px solid ${dashboardCanvasTokens.border}`,
        },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          "&.Mui-selected, &.Mui-selected:hover": {
            backgroundColor: "rgba(242, 140, 91, 0.14)",
          },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          color: dashboardCanvasTokens.text,
          borderColor: dashboardCanvasTokens.border,
        },
      },
    },
    MuiAccordion: {
      styleOverrides: {
        root: {
          color: dashboardCanvasTokens.text,
          backgroundColor: dashboardCanvasTokens.surface,
          backgroundImage: "none",
        },
      },
    },
  },
});
