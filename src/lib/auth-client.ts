import { inferAdditionalFields } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

import type { auth } from "@/lib/auth";

export const authClient = createAuthClient({
  plugins: [inferAdditionalFields<typeof auth>()],
  sessionOptions: {
    refetchInterval: 0,
    refetchOnWindowFocus: true,
  },
});

export function refreshAuthSession() {
  authClient.$store.notify("$sessionSignal");
}
