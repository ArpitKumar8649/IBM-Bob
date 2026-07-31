import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

/**
 * Middleware — protects authenticated routes.
 *
 * /dashboard and /room/* require a session OR demo mode. Demo mode is a
 * cookie set by the landing page's "Try the demo" button, letting visitors
 * explore the app without creating an account. Unauthenticated visitors
 * without the demo cookie are redirected to /signin.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected =
    pathname.startsWith("/dashboard") || pathname.startsWith("/room");

  if (!isProtected) return NextResponse.next();

  // Demo mode bypasses auth.
  if (request.cookies.get("demo_mode")?.value === "true") {
    return NextResponse.next();
  }

  // getToken defaults secureCookie to false, which resolves the session cookie to
  // `authjs.session-token`. Over HTTPS the browser holds the `__Secure-` prefixed
  // name instead — and that name doubles as the JWT's decryption salt, so getting
  // it wrong doesn't merely miss the cookie, it cannot read the one that's there.
  // Guessing from NODE_ENV would be wrong for `next start` over plain http, so ask
  // the request: Vercel terminates TLS and forwards x-forwarded-proto.
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0].trim();
  const secureCookie = forwardedProto
    ? forwardedProto === "https"
    : request.nextUrl.protocol === "https:";

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
    secureCookie,
  });

  if (!token) {
    const signInUrl = new URL("/signin", request.nextUrl.origin);
    signInUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/room/:path*"],
};
