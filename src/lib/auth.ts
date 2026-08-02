import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { after } from "next/server";

import { UserRole } from "@/generated/prisma/enums";
import { sendEmailVerificationMessage } from "@/lib/email/email-verification";
import { sendPasswordResetMessage } from "@/lib/email/password-reset";
import { prisma } from "@/lib/prisma";

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),

  rateLimit: {
    enabled: true,
    customRules: {
      "/send-verification-email": {
        window: 10 * 60,
        max: 3,
      },
      "/request-password-reset": {
        window: 10 * 60,
        max: 3,
      },
      "/reset-password": {
        window: 60,
        max: 10,
      },
    },
  },

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

  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      after(async () => {
        try {
          await sendEmailVerificationMessage({
            email: user.email,
            name: user.name,
            verificationUrl: url,
          });
        } catch {
          // Livrarea rulează după răspuns și nu expune datele
          // destinatarului sau detaliile providerului.
        }
      });
    },
    sendOnSignUp: true,
    sendOnSignIn: false,
    autoSignInAfterVerification: false,
    expiresIn: 60 * 60,
  },

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,

    sendResetPassword: async ({ user, url }) => {
      after(async () => {
        try {
          await sendPasswordResetMessage({
            email: user.email,
            name: user.name,
            resetUrl: url,
          });
        } catch {
          // Livrarea rulează după răspuns și nu expune datele
          // destinatarului sau detaliile providerului.
        }
      });
    },

    resetPasswordTokenExpiresIn: 60 * 60,
    revokeSessionsOnPasswordReset: true,
  },
});
