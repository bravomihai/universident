import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";

import { UserRole } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),

  user: {
    additionalFields: {
      role: {
        type: ["PATIENT", "STUDENT", "ADMIN"],
        required: true,
        defaultValue: "PATIENT",
        input: false,
      },
    },
  },

  databaseHooks: {
    user: {
      create: {
        before: async (user, context) => {
          const accountType =
            context?.path === "/sign-up/email"
              ? context.headers?.get(
                  "x-universident-account-type",
                )
              : null;

          return {
            data: {
              ...user,
              role:
                accountType === "student"
                  ? UserRole.STUDENT
                  : UserRole.PATIENT,
            },
          };
        },
      },
    },
  },

  emailAndPassword: {
    enabled: true,
  },
});