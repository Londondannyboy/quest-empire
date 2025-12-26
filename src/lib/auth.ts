import { createAuthClient } from "better-auth/react";

// Neon Auth URL - points to Neon's managed auth service
const NEON_AUTH_URL = process.env.NEXT_PUBLIC_NEON_AUTH_URL ||
  "https://auth-ep-odd-union-a4tyslmp.us-east-1.aws.neon.tech";

// Neon Auth client
export const authClient = createAuthClient({
  baseURL: NEON_AUTH_URL,
});

// Export commonly used methods
export const { signIn, signUp, signOut, useSession } = authClient;

// Types
export type Session = typeof authClient.$Infer.Session;
export type User = Session["user"];
