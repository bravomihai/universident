export const STUDENT_SIGN_UP_PATH = "/inregistrare?tip=student";

export function signUpAccountType(value: unknown): "patient" | "student" {
  return value === "student" ? "student" : "patient";
}

export function studentJoinDestination(role: string | null | undefined) {
  return role === "STUDENT"
    ? { href: "/cont", label: "Deschide contul tău" }
    : { href: STUDENT_SIGN_UP_PATH, label: "Alătură-te ca student" };
}

export function requiresStudentAccountSwitch(accountType: "patient" | "student", role: string | null | undefined) {
  return accountType === "student" && Boolean(role) && role !== "STUDENT";
}
