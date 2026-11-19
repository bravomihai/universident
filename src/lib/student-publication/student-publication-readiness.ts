import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { UserRole } from "@/generated/prisma/enums";
import { hasConfirmedPolicy } from "@/lib/account/policy-confirmation-service";
import { currentPolicyWhere } from "@/lib/account/policy-confirmations";
import { prisma } from "@/lib/prisma";

export type StudentPublicationRequirement = { code: "EMAIL_NOT_VERIFIED" | "DECLARATION_REQUIRED" | "PROFILE_MISSING" | "PROFILE_INVALID" | "TREATMENT_MISSING" | "LOCATION_MISSING" | "COMPLETE_OFFER_MISSING"; message: string; href: string };
export type StudentPublicationEvaluation = { profileId: string | null; userName: string | null; isPublished: boolean; publishedAt: Date | null; publicSlug: string | null; canPublish: boolean; isPubliclyVisible: boolean; missingRequirements: StudentPublicationRequirement[] };

export function publiclyEligibleStudentProfileWhere() {
  return { isPublished: true, publicSlug: { not: null }, university: { not: "" }, studyYear: { gte: 1, lte: 6 }, user: { role: UserRole.STUDENT, emailVerified: true, ...currentPolicyWhere("studentDeclaration") } } satisfies Prisma.StudentProfileWhereInput;
}

export async function evaluateStudentPublication(transaction: Prisma.TransactionClient, userId: string): Promise<StudentPublicationEvaluation> {
  const profile = await transaction.studentProfile.findUnique({ where: { userId }, include: { user: true } });
  if (!profile) return { profileId: null, userName: null, isPublished: false, publishedAt: null, publicSlug: null, canPublish: false, isPubliclyVisible: false, missingRequirements: [{ code: "PROFILE_MISSING", message: "Completează profilul profesional.", href: "/cont/profil-student" }] };
  const now = new Date();
  const treatments = await transaction.studentTreatment.count({ where: { studentProfileId: profile.id, deletedAt: null, treatment: { isActive: true } } });
  const locations = await transaction.studentLocation.count({ where: { studentProfileId: profile.id, deletedAt: null, city: { isActive: true } } });
  const appearances = await transaction.studentAvailabilitySlot.count({ where: { studentProfileId: profile.id, status: "ACTIVE", startsAt: { gt: now }, studentLocation: { deletedAt: null }, offerings: { some: { removedAt: null, studentTreatment: { deletedAt: null } } } } });
  const missingRequirements: StudentPublicationRequirement[] = [];
  if (profile.user.role !== UserRole.STUDENT || !profile.user.emailVerified) missingRequirements.push({ code: "EMAIL_NOT_VERIFIED", message: "Verifică adresa de email a contului.", href: "/verifica-email" });
  if (!await hasConfirmedPolicy(userId, "studentDeclaration", transaction)) missingRequirements.push({ code: "DECLARATION_REQUIRED", message: "Confirmă corectitudinea informațiilor din profil.", href: "/confirma-reguli" });
  if (profile.university.trim().length < 2 || profile.university.trim().length > 120 || profile.studyYear < 1 || profile.studyYear > 6) missingRequirements.push({ code: "PROFILE_INVALID", message: "Completează universitatea și anul de studiu.", href: "/cont/profil-student" });
  if (!treatments) missingRequirements.push({ code: "TREATMENT_MISSING", message: "Adaugă cel puțin un tratament.", href: "/cont/tratamente" });
  if (!locations) missingRequirements.push({ code: "LOCATION_MISSING", message: "Adaugă cel puțin o locație.", href: "/cont/locatii" });
  if (treatments && locations && !appearances) missingRequirements.push({ code: "COMPLETE_OFFER_MISSING", message: "Adaugă în calendar cel puțin o apariție viitoare complet configurată.", href: "/cont/calendar" });
  const canPublish = missingRequirements.length === 0;
  return { profileId: profile.id, userName: profile.user.name, isPublished: profile.isPublished, publishedAt: profile.publishedAt, publicSlug: profile.publicSlug, canPublish, isPubliclyVisible: profile.isPublished && canPublish && profile.publicSlug !== null, missingRequirements };
}

export async function getStudentPublicationReadiness(userId: string) { return prisma.$transaction((transaction) => evaluateStudentPublication(transaction, userId)); }
