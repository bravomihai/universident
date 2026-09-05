import { UserRole } from "@/generated/prisma/enums";
import { authorizeAccountRequest } from "@/lib/api/account-request";
import { patientProfileAccessWhere } from "@/lib/patient/patient-profile-access";
import { prisma } from "@/lib/prisma";

type Props = { params: Promise<{ imageId: string }> };
const imageIdPattern = /^[a-z0-9_-]{10,64}$/i;

function notFoundResponse() {
  return new Response(null, {
    status: 404,
    headers: { "Cache-Control": "private, no-store", Vary: "Cookie" },
  });
}

export async function GET(request: Request, { params }: Props) {
  const authorization = await authorizeAccountRequest(request, {
    roles: [UserRole.PATIENT, UserRole.STUDENT],
  });
  if (!authorization.ok) return notFoundResponse();

  const { imageId } = await params;
  if (!imageIdPattern.test(imageId)) return notFoundResponse();

  // Filter by the viewer's permissions before loading any image bytes.
  const image = await prisma.patientProfileImage.findFirst({
    where: {
      id: imageId,
      patientProfile: patientProfileAccessWhere(authorization.user),
    },
    select: { data: true, contentType: true, byteSize: true },
  });
  if (!image) return notFoundResponse();

  return new Response(Uint8Array.from(image.data).buffer, {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Type": image.contentType,
      "Content-Length": String(image.byteSize),
      "X-Content-Type-Options": "nosniff",
      "Cross-Origin-Resource-Policy": "same-origin",
      Vary: "Cookie",
    },
  });
}
