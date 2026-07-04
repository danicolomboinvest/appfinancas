import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth.config";

const PUBLIC_PATHS = ["/login", "/register"];

export default auth((req) => {
  const isPublicPath = PUBLIC_PATHS.some((path) => req.nextUrl.pathname.startsWith(path));

  if (!req.auth && !isPublicPath) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (req.auth && isPublicPath) {
    return NextResponse.redirect(new URL("/inicio", req.nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
