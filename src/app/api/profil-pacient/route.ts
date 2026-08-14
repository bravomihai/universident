import { UserRole } from "@/generated/prisma/enums";
import { authorizeAccountRequest } from "@/lib/api/account-request";
import { createPatientProfileSlug } from "@/lib/appointments/appointment-route-slug";
import { parsePatientProfileInput } from "@/lib/patient/patient-profile-input";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const authorization = await authorizeAccountRequest(request, { roles: [UserRole.PATIENT] });
  if (!authorization.ok) return authorization.response;
  const profile = await prisma.patientProfile.findUnique({ where: { userId: authorization.user.id } });
  return Response.json({ profile });
}

export async function PUT(request: Request) {
  const authorization = await authorizeAccountRequest(request, { verifyOrigin: true, roles: [UserRole.PATIENT] });
  if (!authorization.ok) return authorization.response;
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "Datele trimise nu sunt valide." }, { status: 400 }); }
  const parsed = parsePatientProfileInput(body);
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });
  const profile = await prisma.$transaction(async (transaction) => {
    const savedProfile = await transaction.patientProfile.upsert({
      where: { userId: authorization.user.id },
      create: {
        userId: authorization.user.id,
        profileSlug: createPatientProfileSlug(
          parsed.data.name ?? authorization.user.name,
        ),
        dateOfBirth: parsed.data.dateOfBirth,
        bio: parsed.data.bio ?? null,
      },
      update: {
        dateOfBirth: parsed.data.dateOfBirth,
        ...(parsed.data.bio !== undefined ? { bio: parsed.data.bio } : {}),
      },
    });

    if (parsed.data.name !== undefined) {
      await transaction.user.update({
        where: { id: authorization.user.id },
        data: { name: parsed.data.name },
      });
    }

    return savedProfile;
  });
  return Response.json({ profile });
}
