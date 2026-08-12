import { Box } from "@mui/material";
import { ResetPasswordForm } from "@/components/reset-password-form";

export default function ResetPasswordPage() {
  return (
    <Box component="main" sx={authPageStyles}>
      <Suspense fallback={null}><ResetPasswordForm /></Suspense>
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
import { Suspense } from "react";
