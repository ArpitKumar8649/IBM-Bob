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

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
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
