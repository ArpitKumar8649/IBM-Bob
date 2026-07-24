"use client";

import { SessionProvider } from "next-auth/react";

/**
 * Client-side session provider — wraps the app so `useSession()` works
 * in any component. Mounted in the root layout.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
