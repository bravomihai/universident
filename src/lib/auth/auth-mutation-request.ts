import {
  MAX_JSON_REQUEST_BYTES,
  readRequestBytes,
  requestBodyErrorResponse,
} from "@/lib/api/request-body";

const blockedPaths = new Set([
  "/api/auth/request-password-reset",
  "/api/auth/reset-password",
  "/api/auth/change-email",
  "/api/auth/verify-password",
  // Profile edits must go through the role-specific, validated profile APIs.
  "/api/auth/update-user",
]);

export async function prepareAuthMutationRequest(request: Request) {
  let pathname = new URL(request.url).pathname;
  try {
    pathname = decodeURIComponent(pathname);
  } catch {
    return { ok: false as const, response: requestBodyErrorResponse(null) };
  }
  if (blockedPaths.has(pathname.replace(/\/+$/, ""))) {
    return {
      ok: false as const,
      response: Response.json({ error: "Ruta nu este disponibilă." }, {
        status: 404,
        headers: { "Cache-Control": "no-store" },
      }),
    };
  }

  try {
    const body = await readRequestBytes(request, MAX_JSON_REQUEST_BYTES);
    const headers = new Headers(request.headers);
    headers.delete("content-length");
    return {
      ok: true as const,
      request: new Request(request.url, {
        method: request.method,
        headers,
        signal: request.signal,
        body: body.byteLength ? body : null,
      }),
    };
  } catch (error) {
    return { ok: false as const, response: requestBodyErrorResponse(error) };
  }
}
