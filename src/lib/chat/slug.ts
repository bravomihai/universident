export function isChatSlug(value: string) {
  return /^[0-9a-f]{12}$/.test(value);
}

export function chatSlugWhere(slug: string) {
  return isChatSlug(slug) ? { chatSlug: slug } : { routeSlug: slug };
}

function isChatSlugCollision(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error) || error.code !== "P2002" || !("meta" in error)) return false;
  const meta = error.meta;
  if (!meta || typeof meta !== "object") return false;
  if ("target" in meta) {
    if (Array.isArray(meta.target) && meta.target.includes("chatSlug")) return true;
    if (meta.target === "appointment_chatSlug_key") return true;
  }
  // Prisma's PostgreSQL adapter reports quoted fields inside its cause instead.
  const adapter = "driverAdapterError" in meta ? meta.driverAdapterError : null;
  const cause = adapter && typeof adapter === "object" && "cause" in adapter ? adapter.cause : null;
  const constraint = cause && typeof cause === "object" && "constraint" in cause ? cause.constraint : null;
  const fields = constraint && typeof constraint === "object" && "fields" in constraint ? constraint.fields : null;
  return Array.isArray(fields) && fields.some((field) => field === "chatSlug" || field === '"chatSlug"');
}

/** Retry the whole rolled-back booking transaction so the DB generates a new slug. */
export async function withChatSlugRetry<T>(operation: () => Promise<T>) {
  for (let attempt = 0; ; attempt++) {
    try { return await operation(); }
    catch (error) { if (attempt >= 2 || !isChatSlugCollision(error)) throw error; }
  }
}
