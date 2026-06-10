import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const protectedRoutes = ["/home", "/station-meteo", "/projects", "/map", "/admin"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware during OAuth / Firebase-internal flows only
  if (
    pathname.startsWith("/__/auth") ||
    pathname.startsWith("/__/firebase") ||
    pathname.includes("/api/auth")
  ) {
    return NextResponse.next();
  }

  const isProtected = protectedRoutes.some((route) => pathname.startsWith(route));
  if (!isProtected) return NextResponse.next();

  // Session cookie check
  const sessionCookie = request.cookies.get("site_session")?.value;
  if (sessionCookie) return NextResponse.next();

  // Redirect to login with the original URL as a safe redirect target
  const loginUrl = new URL("/", request.url);
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/home/:path*", "/station-meteo/:path*", "/projects/:path*", "/admin/:path*"]
};
