import { redirect } from "next/navigation";
import { AuthFormCard } from "@/components/auth/auth-form-card";
import { PolicyConfirmationForm } from "@/components/auth/policy-confirmation-form";
import Link from "@/components/navigation/app-link";
import { requireAccountPageSession } from "@/lib/account/account-page-session";
import { hasConfirmedPolicy, missingAccountPolicy } from "@/lib/account/policy-confirmation-service";
import { chatPolicyForRole, chatRulesPath, policyConfirmations, privacyNoticePath } from "@/lib/account/policy-confirmations";
import { safeChatReturnTo } from "@/lib/chat/policy";
import { prisma } from "@/lib/prisma";
import { privateRobots } from "@/lib/seo/metadata";

export const metadata = { title: "Confirmări pentru cont", robots: privateRobots };

export default async function AccountConfirmationsPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const query = await searchParams;
  const chatDestination = safeChatReturnTo(query.next);
  const session = await requireAccountPageSession(chatDestination ?? undefined);
  const accountPolicy = await missingAccountPolicy(session.user);
  const chatPolicy = chatDestination ? chatPolicyForRole(session.user.role) : null;
  const policy = accountPolicy ?? (chatPolicy && !await hasConfirmedPolicy(session.user.id, chatPolicy) ? chatPolicy : null);

  if (!policy) redirect(chatDestination ?? (query.next === "acasa" ? "/" : "/cont"));

  const confirmation = policyConfirmations[policy];
  const profile = policy === "studentDeclaration"
    ? await prisma.studentProfile.findUnique({
        where: { userId: session.user.id },
        select: { university: true, studyYear: true },
      })
    : null;

  return (
    <AuthFormCard title={confirmation.title} description="Citește și confirmă înainte de a continua.">
      <div className="space-y-4">
        {policy === "studentDeclaration" ? (
          <div className="space-y-2 text-sm">
            <p>Revizuiește informațiile din profilul profesional înainte de a le confirma.</p>
            {profile ? <p>{session.user.name} · {profile.university} · Anul {profile.studyYear}</p> : null}
            <Link href="/cont/profil-student" className="font-medium underline underline-offset-4">Deschide profilul profesional &gt;</Link>
          </div>
        ) : (
          <Link
            href={policy === "patientPrivacy" ? privacyNoticePath : chatRulesPath}
            target="_blank"
            className="text-sm font-medium underline underline-offset-4"
          >
            {policy === "patientPrivacy" ? "Citește informarea despre datele personale" : "Citește regulile și află cum sunt verificate mesajele"}
          </Link>
        )}
        <PolicyConfirmationForm key={confirmation.version} version={confirmation.version} text={confirmation.text} />
      </div>
    </AuthFormCard>
  );
}
