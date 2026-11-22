import { createHash } from "node:crypto";
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout } from "node:timers/promises";
import { parseArgs } from "node:util";
import nextEnv from "@next/env";

import { currentPolicyWhere, policyConfirmations } from "@/lib/account/policy-confirmations";
import { sendResendEmail } from "@/lib/email/resend";

const policy = "studentDeclaration";
const campaign = `student-declaration-reminder-${policyConfirmations[policy].version}`;
const stateDirectory = join(".local-dev", campaign);
const origin = "https://universident.ro";
const from = "Universident <no-reply@mail.universident.ro>";
const url = `${origin}/confirma-reguli`;
const subject = "Confirmă informațiile din profilul tău Universident";
const message = "Pentru ca pacienții să îți poată vedea profilul profesional pe Universident, verifică informațiile care vor fi afișate public și confirmă declarația de student din contul tău. Confirmarea este necesară pentru publicarea profilului.";
const content = {
  subject,
  text: `Bună,\n\n${message}\n\nIntră în cont și confirmă declarația: ${url}\n\nEchipa Universident`,
  html: `<p>Bună,</p><p>${message}</p><p><a href="${url}">Intră în cont și confirmă declarația</a></p><p>Echipa Universident</p>`,
};
const studentWithProfile = { role: "STUDENT", emailVerified: true, studentProfile: { isNot: null } } as const;
const usage = "Usage: npm run email:student-declaration [-- --send]\nWithout --send, prints the number of eligible students and the email preview.";

function fileErrorHasCode(error: unknown, code: string) {
  return error instanceof Error && "code" in error && error.code === code;
}

async function recipientState(path: string) {
  try {
    const state = await readFile(path, "utf8");
    return state === "attempted\naccepted\n" ? "accepted" : "unconfirmed";
  } catch (error) {
    if (fileErrorHasCode(error, "ENOENT")) return "unsent";
    throw error;
  }
}

async function main() {
  const { values } = parseArgs({ options: { help: { type: "boolean" }, send: { type: "boolean" } } });
  if (values.help) {
    console.log(usage);
    return;
  }

  nextEnv.loadEnvConfig(process.cwd());
  if (!process.env.DATABASE_URL) {
    console.error("Set DATABASE_URL before running this command.");
    process.exitCode = 1;
    return;
  }
  if (values.send && (process.env.BETTER_AUTH_URL?.replace(/\/$/, "") !== origin || !process.env.RESEND_API_KEY?.trim())) {
    console.error(`Sending requires BETTER_AUTH_URL=${origin} and a Resend API key authorized for ${from}.`);
    process.exitCode = 1;
    return;
  }

  const { prisma } = await import("@/lib/prisma");
  const { hasConfirmedPolicy } = await import("@/lib/account/policy-confirmation-service");
  try {
    const [students, confirmed] = await prisma.$transaction([
      prisma.user.findMany({ where: studentWithProfile, select: { id: true }, orderBy: { id: "asc" } }),
      prisma.user.findMany({ where: { ...studentWithProfile, ...currentPolicyWhere(policy) }, select: { id: true } }),
    ], { isolationLevel: "RepeatableRead" });
    const confirmedIds = new Set(confirmed.map(({ id }) => id));
    const recipients = students.filter(({ id }) => !confirmedIds.has(id)).map(({ id }) => {
      const hash = createHash("sha256").update(id).digest("hex");
      return { id, hash, path: join(stateDirectory, hash) };
    });

    const queue = [];
    let accepted = 0;
    let unconfirmed = 0;
    for (const recipient of recipients) {
      const state = await recipientState(recipient.path);
      if (state === "accepted") accepted++;
      else if (state === "unconfirmed") unconfirmed++;
      else queue.push(recipient);
    }

    console.log(`Database host: ${new URL(process.env.DATABASE_URL).hostname}`);
    console.log(`Eligible students: ${recipients.length}. Unsent: ${queue.length}. Previously accepted by Resend: ${accepted}. Attempts to check in Resend: ${unconfirmed}.`);
    if (!values.send) {
      console.log(`Dry run. No emails sent.\n\nFrom: ${from}\nSubject: ${subject}\n\n${content.text}`);
      return;
    }
    if (queue.length === 0) return;

    await mkdir(stateDirectory, { recursive: true, mode: 0o700 });
    let sent = 0;
    for (const { id, hash, path } of queue) {
      const student = await prisma.user.findUnique({ where: { id, ...studentWithProfile }, select: { email: true } });
      if (!student || await hasConfirmedPolicy(id, policy, prisma)) continue;

      try {
        // Reserve the recipient before contacting Resend, including when another run starts concurrently.
        await writeFile(path, "attempted\n", { flag: "wx", mode: 0o600, flush: true });
      } catch (error) {
        if (fileErrorHasCode(error, "EEXIST")) continue;
        throw error;
      }

      try {
        await sendResendEmail({ from, to: student.email, idempotencyKey: `${campaign}/${hash}`, ...content });
        await appendFile(path, "accepted\n");
      } catch {
        console.error(`Stopped after ${sent} successful sends. Check Resend for ${campaign}/${hash} before clearing its attempt record.`);
        process.exitCode = 1;
        return;
      }
      sent++;
      await setTimeout(500);
    }
    console.log(`Resend accepted ${sent} new email(s).`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(() => {
  console.error(`The reminder command could not finish. Check the arguments, environment, database connection and local campaign directory.\n${usage}`);
  process.exitCode = 1;
});
