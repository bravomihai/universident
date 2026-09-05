import { UserRole } from "@/generated/prisma/enums";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type StudentProfileImagePageProps = {
  params: Promise<{ imageId: string }>;
};

const imageIdPattern = /^[a-z0-9_-]{10,64}$/i;

function notFoundResponse() {
  return new Response(null, {
    status: 404,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET(
  request: Request,
  { params }: StudentProfileImagePageProps,
) {
  const { imageId } = await params;
  if (!imageIdPattern.test(imageId)) return notFoundResponse();

  const image = await prisma.studentProfileImage.findUnique({
    where: { id: imageId },
    select: {
      id: true,
      data: true,
      contentType: true,
      byteSize: true,
      updatedAt: true,
      studentProfile: {
        select: {
          userId: true,
          isPublished: true,
          user: { select: { role: true, emailVerified: true } },
        },
      },
    },
  });

  if (!image) return notFoundResponse();

  const isPublic =
    image.studentProfile.isPublished &&
    image.studentProfile.user.role === UserRole.STUDENT &&
    image.studentProfile.user.emailVerified;

  if (!isPublic) {
    const session = await auth.api.getSession({ headers: request.headers });
    if (session?.user.id !== image.studentProfile.userId) {
      return notFoundResponse();
    }
  }

  const etag = `"${image.id}-${image.updatedAt.getTime()}"`;
  const headers = new Headers({
    "Cache-Control": isPublic
      ? "public, max-age=31536000, immutable"
      : "private, no-store",
    "Content-Length": String(image.byteSize),
    "Content-Type": image.contentType,
    ETag: etag,
    "X-Content-Type-Options": "nosniff",
  });

  if (request.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304, headers });
  }

  const responseData = Uint8Array.from(image.data);
  return new Response(responseData.buffer, { headers });
}
