import { UserRole } from "@/generated/prisma/enums";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

import {
    createStudentPublicSlug,
    isStudentPublicSlugCollision,
} from "@/lib/student-public-slug";

type StudentProfileBody = {
    universitySlug?: unknown;
    studyYear?: unknown;
    bio?: unknown;
};

const allowedBodyFields = new Set([
    "universitySlug",
    "studyYear",
    "bio",
]);

export async function PUT(request: Request) {
    const configuredUrl = process.env.BETTER_AUTH_URL;

    if (!configuredUrl) {
        return Response.json(
            { error: "Serverul nu este configurat corect." },
            { status: 500 },
        );
    }

    const origin = request.headers.get("origin");
    const expectedOrigin = new URL(configuredUrl).origin;

    if (origin !== expectedOrigin) {
        return Response.json(
            { error: "Originea cererii nu este permisă." },
            { status: 403 },
        );
    }

    const session = await auth.api.getSession({
        headers: request.headers,
    });

    if (!session) {
        return Response.json(
            { error: "Trebuie să fii autentificat." },
            { status: 401 },
        );
    }

    if (!session.user.emailVerified) {
        return Response.json(
            {
                error:
                    "Verifică adresa de email înainte de a continua.",
                code: "EMAIL_NOT_VERIFIED",
            },
            { status: 403 },
        );
    }

    if (session.user.role !== UserRole.STUDENT) {
        return Response.json(
            { error: "Doar studenții își pot configura profilul profesional." },
            { status: 403 },
        );
    }

    const userId = session.user.id;
    const userName = session.user.name;

    let body: StudentProfileBody;

    try {
        body = (await request.json()) as StudentProfileBody;
    } catch {
        return Response.json(
            { error: "Datele trimise nu sunt valide." },
            { status: 400 },
        );
    }

    if (
        typeof body !== "object" ||
        body === null ||
        Array.isArray(body) ||
        Object.keys(body).some(
            (field) => !allowedBodyFields.has(field),
        )
    ) {
        return Response.json(
            { error: "Datele trimise nu sunt valide." },
            { status: 400 },
        );
    }

    const universitySlug =
        typeof body.universitySlug === "string"
            ? body.universitySlug.trim()
            : "";

    const bio = typeof body.bio === "string" ? body.bio.trim() : "";

    const studyYear =
        typeof body.studyYear === "number" ? body.studyYear : Number.NaN;

    if (!universitySlug) {
        return Response.json(
            { error: "Alege o universitate din listă." },
            { status: 400 },
        );
    }

    const university = await prisma.university.findFirst({
        where: {
            slug: universitySlug,
            isActive: true,
        },
        select: {
            shortName: true,
        },
    });

    if (!university) {
        return Response.json(
            { error: "Universitatea aleasă nu mai este disponibilă. Alege alta din listă." },
            { status: 400 },
        );
    }
    const universityShortName = university.shortName;

    if (!Number.isInteger(studyYear) || studyYear < 1 || studyYear > 6) {
        return Response.json(
            { error: "Anul de studiu trebuie să fie între 1 și 6." },
            { status: 400 },
        );
    }

    if (bio.length > 1000) {
        return Response.json(
            { error: "Descrierea poate avea cel mult 1000 de caractere." },
            { status: 400 },
        );
    }

    const existingProfile = await prisma.studentProfile.findUnique({
        where: {
            userId: userId,
        },
        select: {
            publicSlug: true,
        },
    });

    async function saveProfile(publicSlug: string | null) {
        return prisma.studentProfile.upsert({
            where: {
                userId: userId,
            },
            update: {
                publicSlug,
                university: universityShortName,
                studyYear,
                bio: bio || null,
            },
            create: {
                userId: userId,
                publicSlug,
                university: universityShortName,
                studyYear,
                bio: bio || null,
            },
        });
    }

    const existingPublicSlug = existingProfile?.publicSlug ?? null;

    let profile: Awaited<ReturnType<typeof saveProfile>> | undefined;

    if (existingPublicSlug) {
        profile = await saveProfile(existingPublicSlug);
    } else {
        const maximumAttempts = 5;

        for (let attempt = 0; attempt < maximumAttempts; attempt += 1) {
            const generatedSlug = createStudentPublicSlug(userName);

            try {
                profile = await saveProfile(generatedSlug);
                break;
            } catch (error) {
                if (!isStudentPublicSlugCollision(error)) {
                    throw error;
                }
            }
        }

        if (!profile) {
            return Response.json(
                {
                    error:
                        "Adresa publică a profilului nu a putut fi generată. Încearcă din nou.",
                },
                { status: 500 },
            );
        }
    }

    return Response.json({
        profile,
    });
}
