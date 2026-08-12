import { Box } from "@mui/material";
import { ResetPasswordForm } from "@/components/reset-password-form";
import { authPageStyles } from "@/components/auth-ui";

export default function ResetPasswordPage() {
  return (
    <Box component="main" sx={authPageStyles}>
      <Suspense fallback={null}><ResetPasswordForm /></Suspense>
    </Box>
  );
}

import { Suspense } from "react";
