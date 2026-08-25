import type { Prisma, PrismaClient } from "@/generated/prisma/client";

export const SERIALIZABLE_MAX_ATTEMPTS = 3;
export const SERIALIZABLE_RETRY_BASE_DELAY_MS = 25;
export const SERIALIZABLE_RETRY_MAX_DELAY_MS = 200;

export class SchedulingTemporarilyUnavailableError extends Error {
  readonly code = "SCHEDULING_TEMPORARILY_UNAVAILABLE";

  constructor() {
    super("Operația nu a putut fi finalizată temporar. Încearcă din nou.");
    this.name = "SchedulingTemporarilyUnavailableError";
  }
}

export function isP2034(error: unknown) {
  return Boolean(
    error &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "P2034",
  );
}

type RetryOptions = {
  maxAttempts?: number;
  sleep?: (milliseconds: number) => Promise<void>;
  random?: () => number;
};

const defaultSleep = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

export async function withP2034Retry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {},
) {
  const maxAttempts = options.maxAttempts ?? SERIALIZABLE_MAX_ATTEMPTS;
  const sleep = options.sleep ?? defaultSleep;
  const random = options.random ?? Math.random;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (!isP2034(error)) throw error;
      if (attempt === maxAttempts - 1) {
        throw new SchedulingTemporarilyUnavailableError();
      }
      const exponential = Math.min(
        SERIALIZABLE_RETRY_BASE_DELAY_MS * 2 ** attempt,
        SERIALIZABLE_RETRY_MAX_DELAY_MS,
      );
      const jitter = Math.floor(random() * SERIALIZABLE_RETRY_BASE_DELAY_MS);
      await sleep(exponential + jitter);
    }
  }

  throw new SchedulingTemporarilyUnavailableError();
}

export function runSerializableTransaction<T>(
  client: PrismaClient,
  operation: (transaction: Prisma.TransactionClient) => Promise<T>,
  options: RetryOptions = {},
) {
  return withP2034Retry(
    () => client.$transaction(operation, { isolationLevel: "Serializable" }),
    options,
  );
}
