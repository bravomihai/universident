import type { Prisma } from "@/generated/prisma/client";

export const privacyNoticeTitle = "Cum utilizăm datele tale";

export const policyConfirmations = {
  studentDeclaration: {
    version: "declaratie-student-v1",
    title: "Declarație privind profilul de student",
    text: "Confirm că sunt student la Medicină Dentară și că universitatea, anul de studiu și toate celelalte informații pe care le furnizez în profil și care sunt afișate public sunt reale, corecte, complete și actualizate. Mă oblig să actualizez aceste informații atunci când se modifică.",
  },
  patientPrivacy: {
    version: "informare-date-pacient-v1",
    title: privacyNoticeTitle,
    text: "Confirm că am citit informarea actualizată despre datele prelucrate în Universident.",
  },
  patientChat: {
    version: "reguli-chat-pacient-v1",
    title: "Regulile chatului pentru pacienți",
    publicText: "Pacienții folosesc chatul exclusiv pentru organizarea programărilor. Aici pot stabili o programare, confirma disponibilitatea, modifica ora sau discuta alte detalii logistice. Pacienții nu transmit prin chat documente medicale sau informații precum diagnostice, simptome, alergii, antecedente ori tratamente urmate.",
    text: "Am înțeles că folosesc chatul exclusiv pentru organizarea programării: stabilirea programării, confirmarea disponibilității, modificarea orei sau alte detalii logistice. Nu voi transmite prin chat documente medicale sau informații precum diagnostice, simptome, alergii, antecedente ori tratamente urmate.",
  },
  studentChat: {
    version: "reguli-chat-student-v1",
    title: "Regulile chatului pentru studenți",
    publicText: "Studenții folosesc chatul exclusiv pentru organizarea programărilor. Ei nu solicită și nu transmit prin chat informații sau documente medicale.",
    text: "Voi folosi chatul exclusiv pentru organizarea programării. Nu voi solicita sau transmite informații sau documente medicale prin chat.",
  },
} as const;

export type AccountPolicy = keyof typeof policyConfirmations;

export function currentPolicyWhere(policy: AccountPolicy): Prisma.UserWhereInput {
  const version = policyConfirmations[policy].version;
  const confirmation = { policyConfirmations: { some: { policy, version } } };

  if (policy === "patientChat" || policy === "studentChat") return confirmation;
  return { OR: [{ signupPolicyVersion: version, signupPolicyConfirmedAt: { not: null } }, confirmation] };
}

export const signUpPolicyHeader = "x-universident-policy-version";
export const privacyNoticePath = "/informare-date-personale";
export const chatRulesPath = "/cont/mesaje/despre-verificare";

export function accountPolicyForRole(role: string): AccountPolicy | null {
  if (role === "STUDENT") return "studentDeclaration";
  if (role === "PATIENT") return "patientPrivacy";
  return null;
}

export function chatPolicyForRole(role: string): AccountPolicy | null {
  if (role === "STUDENT") return "studentChat";
  if (role === "PATIENT") return "patientChat";
  return null;
}

export function policyFromConfirmation(role: string, body: unknown): AccountPolicy | null {
  if (!body || typeof body !== "object" || !("confirmed" in body) || body.confirmed !== true || !("version" in body)) return null;
  return [accountPolicyForRole(role), chatPolicyForRole(role)].find(
    (policy) => policy && policyConfirmations[policy].version === body.version,
  ) ?? null;
}
