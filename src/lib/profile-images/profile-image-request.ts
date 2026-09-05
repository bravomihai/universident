import {
  MAX_PROFILE_IMAGE_BYTES,
  validateProfileImage,
} from "@/lib/student-profile/profile-image-validation";

const maximumRequestBytes = MAX_PROFILE_IMAGE_BYTES + 256 * 1024;

function invalidRequest(error: string, code: string, status: number) {
  return {
    ok: false as const,
    response: Response.json({ error, code }, {
      status,
      headers: { "Cache-Control": "no-store" },
    }),
  };
}

export async function readProfileImageRequest(request: Request) {
  if (!request.headers.get("content-type")?.startsWith("multipart/form-data")) {
    return invalidRequest("Formatul cererii nu este acceptat.", "INVALID_REQUEST", 415);
  }

  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maximumRequestBytes) {
    return invalidRequest("Imaginea poate avea cel mult 2 MB.", "IMAGE_TOO_LARGE", 413);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return invalidRequest("Imaginea trimisă nu este validă.", "INVALID_REQUEST", 400);
  }

  const formKeys = [...formData.keys()];
  const imageValue = formData.get("image");
  if (formKeys.length !== 1 || formKeys[0] !== "image" || !(imageValue instanceof File)) {
    return invalidRequest("Alege o singură imagine.", "INVALID_REQUEST", 400);
  }

  if (imageValue.size > MAX_PROFILE_IMAGE_BYTES) {
    return invalidRequest("Imaginea poate avea cel mult 2 MB.", "IMAGE_TOO_LARGE", 413);
  }

  const validation = validateProfileImage(new Uint8Array(await imageValue.arrayBuffer()));
  if (!validation.ok) {
    return invalidRequest(validation.error, validation.code, validation.code === "IMAGE_TOO_LARGE" ? 413 : 400);
  }

  return validation;
}
