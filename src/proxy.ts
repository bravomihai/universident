import { NextResponse, type NextRequest } from "next/server";
import { robotsHeader } from "@/lib/seo/config";
import { PublicRequestLimiter, publicReadLimitResponse } from "@/lib/security/public-request-limit";

const publicRequestLimiter = new PublicRequestLimiter();

// Authentication and ownership stay in server pages and API handlers.
// This cheap, per-process guard runs before public reads reach PostgreSQL.
export function proxy(request: NextRequest) {
  const limited = publicReadLimitResponse(request, publicRequestLimiter, process.env.PUBLIC_REQUEST_IP_HEADER);
  if (limited) return limited;
  const response = NextResponse.next();
  const robots = robotsHeader(request.nextUrl.pathname, request.headers.get("host") ?? "");
  if (robots) response.headers.set("X-Robots-Tag", robots);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
