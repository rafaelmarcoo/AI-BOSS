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
