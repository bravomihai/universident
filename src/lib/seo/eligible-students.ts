import type { Prisma } from "@/generated/prisma/client";

// Both fixtures are local-only. The original scenario may retain a real slug,
// so also exclude profiles associated with demo resources, not just demo slugs.
export function realStudentProfileWhere(): Prisma.StudentProfileWhereInput {
  return {
    NOT: [
      { id: { startsWith: "demo-ui-" } },
      { publicSlug: { startsWith: "student-demo-" } },
      { userId: { startsWith: "demo-ui-" } },
      { user: { email: { endsWith: "@demo.universident.test", mode: "insensitive" } } },
      { locations: { some: { id: { startsWith: "demo-ui-" } } } },
      { availabilitySlots: { some: { id: { startsWith: "demo-ui-" } } } },
    ],
  };
}
