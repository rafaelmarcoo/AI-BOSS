import { Box } from "@mui/material";
import { PasswordRecoveryForm } from "@/components/password-recovery-form";
import { authPageStyles } from "@/components/auth-ui";

export default function ForgotPasswordPage() {
  return (
    <Box component="main" sx={authPageStyles}>
      <PasswordRecoveryForm />
    </Box>
  );
}
