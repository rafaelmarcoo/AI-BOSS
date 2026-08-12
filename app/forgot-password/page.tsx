import { Box } from "@mui/material";
import { PasswordRecoveryForm } from "@/components/password-recovery-form";

export default function ForgotPasswordPage() {
  return (
    <Box component="main" sx={authPageStyles}>
      <PasswordRecoveryForm />
    </Box>
  );
}

const authPageStyles = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "radial-gradient(circle at top, rgba(226,232,240,0.9), rgba(248,250,252,1) 55%)",
  px: 3,
  py: 8,
};
