import { dashboardTokens } from "@/app/theme";

export const authPageStyles = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  bgcolor: dashboardTokens.shell,
  px: { xs: 2, sm: 3 },
  py: { xs: 4, sm: 6 },
};

export const authCardStyles = {
  width: "100%",
  maxWidth: 480,
  p: { xs: 3, sm: 4.5 },
  borderRadius: "14px",
  border: "1px solid",
  borderColor: dashboardTokens.border,
  bgcolor: dashboardTokens.surface,
  color: dashboardTokens.text,
  boxShadow: "0 18px 50px rgba(0, 0, 0, 0.24)",
};

export const authFieldStyles = {
  "& .MuiInputLabel-root": {
    color: dashboardTokens.textMuted,
    fontSize: 14,
    "&.Mui-focused": { color: dashboardTokens.accentHover },
  },
  "& .MuiOutlinedInput-root": {
    minHeight: 50,
    bgcolor: dashboardTokens.surfaceAlt,
    color: dashboardTokens.text,
    borderRadius: `${dashboardTokens.radiusMd}px`,
    fontSize: 15,
    "& fieldset": { borderColor: dashboardTokens.borderInput },
    "&:hover fieldset": { borderColor: dashboardTokens.borderMuted },
    "&.Mui-focused fieldset": {
      borderColor: dashboardTokens.accent,
      borderWidth: 1,
    },
    "&.Mui-focused": {
      boxShadow: "0 0 0 3px rgba(79, 125, 243, 0.12)",
    },
  },
  "& .MuiInputBase-input::placeholder": {
    color: dashboardTokens.textSubtle,
    opacity: 1,
  },
  "& .MuiFormHelperText-root": {
    mx: 0,
    mt: 0.75,
    color: dashboardTokens.textSubtle,
    fontSize: 12,
  },
};
