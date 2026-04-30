import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // allowedDevOrigins is used for local Xero OAuth testing with ngrok.
  // ngrok provides an HTTPS tunnel to localhost which Xero requires for OAuth redirect URIs.
  // Add your personal ngrok URL here when testing locally — do not commit your ngrok URL.
  // Example: 'your-id.ngrok-free.app'
  // This setting is not needed in production (Vercel provides HTTPS automatically).
  // Remove 'unviolative-danika-untamely.ngrok-free.dev' and add your own ngrok URL when testing locally.
  allowedDevOrigins: ['unviolative-danika-untamely.ngrok-free.dev'],
};

export default nextConfig;
