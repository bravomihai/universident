export class ChatError extends Error {
  constructor(public code: string, message: string, public status = 400) {
    super(message);
    this.name = "ChatError";
  }
}

export function chatErrorResponse(error: unknown) {
  const known = error instanceof ChatError;
  return Response.json({
    error: known ? error.message : "Mesajele nu sunt disponibile momentan. Încearcă din nou.",
    code: known ? error.code : "CHAT_UNAVAILABLE",
  }, {
    status: known ? error.status : 503,
    headers: { "Cache-Control": "no-store", ...((known && error.status === 429) ? { "Retry-After": "60" } : {}) },
  });
}
