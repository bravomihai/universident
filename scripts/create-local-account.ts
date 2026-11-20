import { randomUUID } from "node:crypto";
import nextEnv from "@next/env";
import { hashPassword } from "better-auth/crypto";

import { UserRole } from "../src/generated/prisma/enums";
import { assertLocalDemoDatabase } from "./lib/local-demo-options";

const accountTypes = {
  pacient: { role: UserRole.PATIENT, name: "Pacient Test" },
  student: { role: UserRole.STUDENT, name: "Student Test" },
} as const;

async function main() {
  const target = process.argv[2];
  if (target !== "pacient" && target !== "student") {
    throw new Error("Choose the pacient or student Make target.");
  }

  const [, emailInput, password] = /^\s*(\S+)[ \t]([\s\S]+)$/.exec(process.env.ARGS ?? "") ?? [];
  if (!emailInput || !password) {
    throw new Error(`Usage: make ${target} ARGS='email password'`);
  }

  const email = emailInput.toLowerCase();
  if (!/^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/.test(email)) {
    throw new Error("Enter a valid email address.");
  }

  const { DATABASE_URL: databaseUrl, NODE_ENV: nodeEnv } =
    nextEnv.loadEnvConfig(process.cwd(), true).combinedEnv;
  assertLocalDemoDatabase(databaseUrl, nodeEnv);
  if (new URL(databaseUrl).searchParams.has("host")) {
    throw new Error("DATABASE_URL must specify the local database host directly.");
  }

  const { prisma } = await import("../src/lib/prisma");
  const { role, name } = accountTypes[target];
  const userId = randomUUID();

  try {
    // Write the account directly and use the same password hash as application sign-in.
    await prisma.user.create({
      data: {
        id: userId,
        name,
        email,
        role,
        emailVerified: true,
        accounts: {
          create: {
            id: randomUUID(),
            accountId: userId,
            providerId: "credential",
            password: await hashPassword(password),
          },
        },
      },
    });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      throw new Error("An account with this email address already exists.");
    }
    throw new Error("Could not create the account. Check that the local database is running and migrated.");
  } finally {
    await prisma.$disconnect();
  }

  console.log(`Created verified ${role.toLowerCase()} account: ${email}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Could not create the local account.");
  process.exitCode = 1;
});
