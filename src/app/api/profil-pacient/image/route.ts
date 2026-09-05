import { UserRole } from "@/generated/prisma/enums";
import { authorizeAccountRequest } from "@/lib/api/account-request";
import { createPatientProfileSlug } from "@/lib/appointments/appointment-route-slug";
import { patientProfileImageUrl } from "@/lib/patient/patient-profile-image";
import { prisma } from "@/lib/prisma";
import { readProfileImageRequest } from "@/lib/profile-images/profile-image-request";

function jsonResponse(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function PUT(request: Request) {
  const authorization = await authorizeAccountRequest(request, {
    verifyOrigin: true,
    roles: [UserRole.PATIENT],
  });
  if (!authorization.ok) return authorization.response;

  const validation = await readProfileImageRequest(request);
  if (!validation.ok) return validation.response;

  try {
    const imageData = Uint8Array.from(validation.data);
    const image = await prisma.$transaction(async (transaction) => {
      // A photo does not require a birth date or bio, and must never replace them.
      const profile = await transaction.patientProfile.upsert({
        where: { userId: authorization.user.id },
        create: {
          userId: authorization.user.id,
          profileSlug: createPatientProfileSlug(authorization.user.name),
        },
        update: {},
        select: { id: true },
      });

      return transaction.patientProfileImage.upsert({
        where: { patientProfileId: profile.id },
        create: {
          patientProfileId: profile.id,
          data: imageData,
          contentType: validation.contentType,
          byteSize: imageData.byteLength,
        },
        update: {
          data: imageData,
          contentType: validation.contentType,
          byteSize: imageData.byteLength,
        },
        select: { id: true, updatedAt: true },
      });
    });

    return jsonResponse({ imageUrl: patientProfileImageUrl(image) });
  } catch (error) {
    console.error("Patient profile image upload failed:", error);
    return jsonResponse(
      { error: "Fotografia nu a putut fi salvată.", code: "IMAGE_SAVE_FAILED" },
      500,
    );
  }
}

export async function DELETE(request: Request) {
  const authorization = await authorizeAccountRequest(request, {
    verifyOrigin: true,
    roles: [UserRole.PATIENT],
  });
  if (!authorization.ok) return authorization.response;

  try {
    await prisma.patientProfileImage.deleteMany({
      where: { patientProfile: { userId: authorization.user.id } },
    });

    return jsonResponse({ status: true });
  } catch (error) {
    console.error("Patient profile image deletion failed:", error);
    return jsonResponse(
      { error: "Fotografia nu a putut fi ștearsă.", code: "IMAGE_DELETE_FAILED" },
      500,
    );
  }
}
