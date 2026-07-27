import { UserRole } from "@/generated/prisma/enums";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

import { createStudentPublicSlug } from "@/lib/student-public-slug";

type StudentProfileBody = {
    university?: unknown;
    studyYear?: unknown;
    bio?: unknown;
};

const allowedBodyFields = new Set([
    "university",
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

    function isPublicSlugCollision(error: unknown) {
        if (
            typeof error !== "object" ||
            error === null ||
            !("code" in error) ||
            error.code !== "P2002"
        ) {
            return false;
        }

        if (!("meta" in error)) {
            return false;
        }

        const meta = error.meta;

        if (
            typeof meta !== "object" ||
            meta === null ||
            !("target" in meta)
        ) {
            return false;
        }

        const target = meta.target;

        return Array.isArray(target)
            ? target.includes("publicSlug")
            : String(target).includes("publicSlug");
    }

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

    const university =
        typeof body.university === "string" ? body.university.trim() : "";

    const bio = typeof body.bio === "string" ? body.bio.trim() : "";

    const studyYear =
        typeof body.studyYear === "number" ? body.studyYear : Number.NaN;

    if (university.length < 2 || university.length > 120) {
        return Response.json(
            { error: "Universitatea trebuie să conțină între 2 și 120 de caractere." },
            { status: 400 },
        );
    }

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
                university,
                studyYear,
                bio: bio || null,
            },
            create: {
                userId: userId,
                publicSlug,
                university,
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
                if (!isPublicSlugCollision(error)) {
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
