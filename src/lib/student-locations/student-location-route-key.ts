import * as crypto from "node:crypto";

export const studentLocationRouteKeyPattern = /^[0-9a-f]{6}$/;

export function createStudentLocationRouteKey(): string {
  return crypto.randomBytes(3).toString("hex");
}

export function isStudentLocationRouteKey(value: string): boolean {
  return studentLocationRouteKeyPattern.test(value);
}

export function isStudentLocationRouteKeyCollision(
  error: unknown,
): boolean {
  if (
    typeof error !== "object" ||
    error === null ||
    !("code" in error) ||
    error.code !== "P2002" ||
    !("meta" in error)
  ) {
    return false;
  }

  const meta = error.meta;

  if (
    typeof meta !== "object" ||
    meta === null ||
    !("target" in meta)
  ) {
    return false;
  }

  const target = meta.target;

  if (Array.isArray(target)) {
    return target.some((field) =>
      String(field).includes("routeKey"),
    );
  }

  return String(target).includes("routeKey");
}
