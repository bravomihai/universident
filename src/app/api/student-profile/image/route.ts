import { UserRole } from "@/generated/prisma/enums";
import { authorizeAccountRequest } from "@/lib/api/account-request";
import { prisma } from "@/lib/prisma";
import { studentProfileImageUrl } from "@/lib/student-profile/student-profile-image";
import {
  MAX_PROFILE_IMAGE_BYTES,
  validateProfileImage,
} from "@/lib/student-profile/profile-image-validation";

const maximumRequestBytes = MAX_PROFILE_IMAGE_BYTES + 256 * 1024;

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

  if (!request.headers.get("content-type")?.startsWith("multipart/form-data")) {
    return jsonResponse(
      { error: "Formatul cererii nu este acceptat.", code: "INVALID_REQUEST" },
      415,
    );
  }

  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maximumRequestBytes) {
    return jsonResponse(
      { error: "Imaginea poate avea cel mult 2 MB.", code: "IMAGE_TOO_LARGE" },
      413,
    );
  }

  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    return jsonResponse(
      { error: "Imaginea trimisă nu este validă.", code: "INVALID_REQUEST" },
      400,
    );
  }

  const formKeys = [...formData.keys()];
  const imageValue = formData.get("image");
  if (
    formKeys.length !== 1 ||
    formKeys[0] !== "image" ||
    !(imageValue instanceof File)
  ) {
    return jsonResponse(
      { error: "Alege o singură imagine.", code: "INVALID_REQUEST" },
      400,
    );
  }

  if (imageValue.size > MAX_PROFILE_IMAGE_BYTES) {
    return jsonResponse(
      { error: "Imaginea poate avea cel mult 2 MB.", code: "IMAGE_TOO_LARGE" },
      413,
    );
  }

  const validation = validateProfileImage(
    new Uint8Array(await imageValue.arrayBuffer()),
  );
  if (!validation.ok) {
    return jsonResponse(
      { error: validation.error, code: validation.code },
      validation.code === "IMAGE_TOO_LARGE" ? 413 : 400,
    );
  }

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
