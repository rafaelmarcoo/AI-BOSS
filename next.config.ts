import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  allowedDevOrigins: ['unviolative-danika-untamely.ngrok-free.dev'],
};

export default nextConfig;

  // WHY THIS IS NEEDED:
  // Normally you access your app at http://localhost:3000
  // Next.js hot reload (the feature that refreshes the browser when you save a file)
  // works because the browser and server are both on localhost
  //
  // When using ngrok, your app is accessed through a public HTTPS URL like
  // https://unviolative-danika-untamely.ngrok-free.dev
  // Next.js sees this as a "cross-origin" request (different domain than localhost)
  // and blocks it by default for security reasons
  //
  // Adding the ngrok URL here tells Next.js to allow it during development
  //
  // WHY WE NEED NGROK:
  // Xero's OAuth requires HTTPS for the redirect URI
  // Local development only has http://localhost:3000 which Xero rejects
  // ngrok creates a temporary public HTTPS tunnel to your localhost
  // so Xero can redirect back to your machine after the user approves access
  //
  // IMPORTANT: this is only for local development
  // In production on Vercel, the app already has HTTPS so ngrok is not needed
  // The ngrok URL here will be different for every developer and changes
  // every time ngrok is restarted on the free plan
  // Each developer needs to add their own ngrok URL here when testing locally