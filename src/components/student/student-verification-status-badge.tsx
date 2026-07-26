import {
  BadgeCheck,
  CircleX,
  Clock3,
  FileQuestion,
  type LucideIcon,
} from "lucide-react";

import { StudentVerificationStatus } from "@/generated/prisma/enums";

type VerificationStatusContent = {
  label: string;
  description: string;
  icon: LucideIcon;
};

const verificationStatusContent: Record<
  StudentVerificationStatus,
  VerificationStatusContent
> = {
  [StudentVerificationStatus.NOT_SUBMITTED]: {
    label: "Netrimis",
    description:
      "Profilul nu a fost încă trimis pentru verificare.",
    icon: FileQuestion,
  },
  [StudentVerificationStatus.PENDING]: {
    label: "În verificare",
    description:
      "Profilul a fost trimis și așteaptă verificarea administrativă.",
    icon: Clock3,
  },
  [StudentVerificationStatus.APPROVED]: {
    label: "Aprobat",
    description:
      "Profilul a trecut verificarea administrativă.",
    icon: BadgeCheck,
  },
  [StudentVerificationStatus.REJECTED]: {
    label: "Respins",
    description:
      "Profilul necesită modificări înainte de o nouă verificare.",
    icon: CircleX,
  },
};

type StudentVerificationStatusBadgeProps = {
  status: StudentVerificationStatus;
  showDescription?: boolean;
};

export function StudentVerificationStatusBadge({
  status,
  showDescription = false,
}: StudentVerificationStatusBadgeProps) {
  const content = verificationStatusContent[status];
  const StatusIcon = content.icon;

  return (
    <div className="space-y-2">
      <span className="inline-flex items-center gap-1.5 rounded-full border bg-muted/40 px-2.5 py-1 text-xs font-medium">
        <StatusIcon className="size-3.5" aria-hidden="true" />
        {content.label}
      </span>

      {showDescription ? (
        <p className="text-sm text-muted-foreground">
          {content.description}
        </p>
      ) : null}
    </div>
  );
}
