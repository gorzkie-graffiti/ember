import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/auth/token";

/**
 * Edge gate for the private surfaces (Next 16's `proxy`, formerly middleware).
 *
 * This only checks the signed session token — no DB access at the edge — so it
 * is the cheap first line of defense. Pages and API routes still re-verify
 * against the database, which makes revocation immediate rather than waiting
 * for the token to expire.
 */
const PROTECTED_PREFIXES = ["/chat", "/admin"];
const ADMIN_PREFIXES = ["/admin"];

function matches(pathname: string, prefixes: string[]): boolean {
  return prefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!matches(pathname, PROTECTED_PREFIXES)) return NextResponse.next();

  const payload = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!payload) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }

  if (matches(pathname, ADMIN_PREFIXES) && payload.role !== "admin") {
    const url = req.nextUrl.clone();
    url.pathname = "/chat";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/chat/:path*", "/admin/:path*"],
};
