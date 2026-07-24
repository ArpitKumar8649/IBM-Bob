import { DefaultSession } from "next-auth";

/**
 * Augment the NextAuth session type so `session.user.id` is available
 * throughout the app (set in the jwt callback in auth.ts).
 */
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}
