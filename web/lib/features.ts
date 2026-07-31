/**
 * Build-time feature flags.
 *
 * NEXT_PUBLIC_* values are inlined by Next at build time, so these are constants
 * in the client bundle and the guarded JSX is dropped entirely when a flag is off.
 */

/**
 * Google sign-in is only offered when the deployment was given an OAuth client.
 * NextAuth accepts an empty clientId/clientSecret without complaint, so the
 * button would render and then fail at Google's end — hiding it is the honest
 * default. Set NEXT_PUBLIC_GOOGLE_AUTH=true alongside GOOGLE_CLIENT_ID and
 * GOOGLE_CLIENT_SECRET to turn it back on.
 */
export const googleAuthEnabled = process.env.NEXT_PUBLIC_GOOGLE_AUTH === "true";
