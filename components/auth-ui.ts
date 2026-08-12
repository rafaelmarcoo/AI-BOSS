export const authPageStyles = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background:
    "radial-gradient(circle at top, rgba(30, 64, 175, 0.24), transparent 42%), #06060f",
  px: 3,
  py: 8,
};

export const authCardStyles = {
  width: "100%",
  maxWidth: 448,
  p: { xs: 3, sm: 4 },
  borderRadius: "2rem",
  border: "1px solid",
  borderColor: "rgba(255,255,255,0.12)",
  bgcolor: "rgba(17, 24, 39, 0.94)",
  color: "common.white",
  boxShadow: "0 28px 90px rgba(0, 0, 0, 0.42)",
};

export const authFieldStyles = {
  "& .MuiInputLabel-root": { color: "rgba(255,255,255,0.68)" },
  "& .MuiOutlinedInput-root": {
    bgcolor: "rgba(255,255,255,0.055)",
    color: "common.white",
    borderRadius: 2.5,
    "& fieldset": { borderColor: "rgba(255,255,255,0.16)" },
    "&:hover fieldset": { borderColor: "rgba(255,255,255,0.28)" },
  },
  "& .MuiFormHelperText-root": { color: "rgba(255,255,255,0.58)" },
};
