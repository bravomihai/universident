import { UserRole } from "@/generated/prisma/enums";
import { authorizeAccountRequest } from "@/lib/api/account-request";
import { prisma } from "@/lib/prisma";
import { studentProfileImageUrl } from "@/lib/student-profile/student-profile-image";
import { readProfileImageRequest } from "@/lib/profile-images/profile-image-request";

function jsonResponse(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

async function requireStudentProfile(request: Request) {
  const authorization = await authorizeAccountRequest(request, {
    verifyOrigin: true,
    roles: [UserRole.STUDENT],
  });

  if (!authorization.ok) return authorization;

  const profile = await prisma.studentProfile.findUnique({
    where: { userId: authorization.user.id },
    select: { id: true },
  });

  if (!profile) {
    return {
      ok: false as const,
      response: jsonResponse(
        {
          error: "Salvează mai întâi informațiile profesionale.",
          code: "PROFILE_MISSING",
        },
        404,
      ),
    };
  }

  return { ok: true as const, profile };
}

export async function PUT(request: Request) {
  const result = await requireStudentProfile(request);
  if (!result.ok) return result.response;

  const validation = await readProfileImageRequest(request);
  if (!validation.ok) return validation.response;

  try {
    const imageData = Uint8Array.from(validation.data);
    const image = await prisma.studentProfileImage.upsert({
      where: { studentProfileId: result.profile.id },
      create: {
        studentProfileId: result.profile.id,
        data: imageData,
        contentType: validation.contentType,
        byteSize: validation.data.byteLength,
      },
      update: {
        data: imageData,
        contentType: validation.contentType,
        byteSize: validation.data.byteLength,
      },
      select: { id: true, updatedAt: true },
    });

    return jsonResponse({
      imageUrl: studentProfileImageUrl(image),
    });
  } catch (error) {
    console.error("Student profile image upload failed:", error);
    return jsonResponse(
      { error: "Fotografia nu a putut fi salvată.", code: "IMAGE_SAVE_FAILED" },
      500,
    );
  }
}

export async function DELETE(request: Request) {
  const result = await requireStudentProfile(request);
  if (!result.ok) return result.response;

  try {
    await prisma.studentProfileImage.deleteMany({
      where: { studentProfileId: result.profile.id },
    });

    return jsonResponse({ status: true });
  } catch (error) {
    console.error("Student profile image deletion failed:", error);
    return jsonResponse(
      { error: "Fotografia nu a putut fi ștearsă.", code: "IMAGE_DELETE_FAILED" },
      500,
    );
  }
}
