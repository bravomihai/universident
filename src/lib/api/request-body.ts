export const MAX_JSON_REQUEST_BYTES = 256 * 1024;

export class RequestBodyTooLargeError extends Error {
  constructor() {
    super("Cererea este prea mare.");
    this.name = "RequestBodyTooLargeError";
  }
}

// Count bytes from the stream: Content-Length can be missing or inaccurate.
export async function readRequestBytes(request: Request, maximumBytes: number): Promise<ArrayBuffer> {
  const contentLength = request.headers.get("content-length");
  if (contentLength && /^\d+$/.test(contentLength) && Number(contentLength) > maximumBytes) {
    void request.body?.cancel().catch(() => {});
    throw new RequestBodyTooLargeError();
  }

  const reader = request.body?.getReader();
  if (!reader) return new ArrayBuffer(0);
  const chunks: Uint8Array[] = [];
  let byteLength = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      byteLength += chunk.value.byteLength;
      if (byteLength > maximumBytes) {
        // A slow or failing cancellation must not delay the rejection.
        void reader.cancel().catch(() => {});
        throw new RequestBodyTooLargeError();
      }
      chunks.push(chunk.value);
    }
  } finally {
    reader.releaseLock();
  }

  const result = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result.buffer;
}

export function requestBodyErrorResponse(error: unknown) {
  const tooLarge = error instanceof RequestBodyTooLargeError;
  return Response.json({
    error: tooLarge ? "Cererea este prea mare." : "Datele trimise nu sunt valide.",
    code: tooLarge ? "INPUT_TOO_LARGE" : "INVALID_REQUEST",
  }, {
    status: tooLarge ? 413 : 400,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function readJsonRequest(request: Request) {
  try {
    const bytes = await readRequestBytes(request, MAX_JSON_REQUEST_BYTES);
    const data: unknown = JSON.parse(new TextDecoder().decode(bytes));
    return { ok: true as const, data };
  } catch (error) {
    return { ok: false as const, response: requestBodyErrorResponse(error) };
  }
}
