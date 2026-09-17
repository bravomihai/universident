import { NextResponse, type NextRequest } from "next/server";
import { robotsHeader } from "@/lib/seo/config";

// Crawling policy only. Authentication and ownership stay in the existing
// server pages and API handlers; redirects also receive the private header.
export function proxy(request: NextRequest) {
  const response = NextResponse.next();
  const robots = robotsHeader(request.nextUrl.pathname, request.headers.get("host") ?? "");
  if (robots) response.headers.set("X-Robots-Tag", robots);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
