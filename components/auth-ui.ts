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

export const authEntryColors = {
  background: "#29465F",
  card: "#FBFAF7",
  input: "#FFFFFF",
  text: "#163A5A",
  muted: "#66788C",
  subtle: "#7B8A9A",
  border: "#D8E3EC",
  borderHover: "#9EB3C4",
  accent: "#F28C5B",
  accentHover: "#E57D4C",
  link: "#9B4825",
} as const;

const authEntryFontFamily =
  'var(--font-poppins), Poppins, "Segoe UI", sans-serif';

export const authEntryPageStyles = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  bgcolor: authEntryColors.background,
  px: { xs: 2, sm: 3 },
  py: { xs: 4, sm: 6 },
  fontFamily: authEntryFontFamily,
  "& .MuiTypography-root, & .MuiButtonBase-root, & .MuiInputBase-root, & .MuiFormLabel-root": {
    fontFamily: authEntryFontFamily,
  },
};

export const authEntryCardStyles = {
  width: "100%",
  maxWidth: 500,
  p: { xs: 3, sm: 4.5 },
  borderRadius: "20px",
  border: "1px solid",
  borderColor: authEntryColors.border,
  bgcolor: authEntryColors.card,
  color: authEntryColors.text,
  boxShadow: "0 22px 60px rgba(10, 28, 44, 0.22)",
};

export const authEntryFieldStyles = {
  "& .MuiInputLabel-root": {
    color: authEntryColors.muted,
    fontSize: 13,
    fontWeight: 400,
    "&.Mui-focused": { color: authEntryColors.text },
  },
  "& .MuiOutlinedInput-root": {
    minHeight: 50,
    bgcolor: authEntryColors.input,
    color: authEntryColors.text,
    borderRadius: "12px",
    fontSize: 14,
    fontWeight: 400,
    "& fieldset": { borderColor: authEntryColors.border },
    "&:hover fieldset": { borderColor: authEntryColors.borderHover },
    "&.Mui-focused fieldset": {
      borderColor: authEntryColors.accent,
      borderWidth: 1,
    },
    "&.Mui-focused": {
      boxShadow: "0 0 0 3px rgba(242, 140, 91, 0.16)",
    },
  },
  "& .MuiInputBase-input::placeholder": {
    color: authEntryColors.subtle,
    opacity: 1,
  },
  "& .MuiInputBase-input:-webkit-autofill": {
    WebkitBoxShadow: `0 0 0 1000px ${authEntryColors.input} inset`,
    WebkitTextFillColor: authEntryColors.text,
    caretColor: authEntryColors.text,
    borderRadius: "inherit",
  },
  "& .MuiFormHelperText-root": {
    mx: 0,
    mt: 0.75,
    color: authEntryColors.subtle,
    fontSize: 11,
    fontWeight: 400,
  },
};
