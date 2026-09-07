export type LocalDemoOptions = {
  dryRun: boolean;
  directoryOnly: boolean;
  scenario: "full" | "booking";
  refresh: "available" | "cooldown";
  patientEmail?: string;
  studentEmail?: string;
};

export function parseLocalDemoOptions(args: string[]): LocalDemoOptions {
  const options: LocalDemoOptions = {
    dryRun: false,
    directoryOnly: false,
    scenario: "full",
    refresh: "available",
  };

  for (const argument of args) {
    if (argument === "--dry-run") options.dryRun = true;
    else if (argument === "--directory-only") options.directoryOnly = true;
    else if (argument === "--scenario=full") options.scenario = "full";
    else if (argument === "--scenario=booking") options.scenario = "booking";
    else if (argument === "--refresh=available") options.refresh = "available";
    else if (argument === "--refresh=cooldown") options.refresh = "cooldown";
    else if (argument.startsWith("--patient-email=")) options.patientEmail = selectedEmail(argument);
    else if (argument.startsWith("--student-email=")) options.studentEmail = selectedEmail(argument);
    else throw new Error(`Opțiune demo necunoscută: ${argument}`);
  }

  return options;
}

function selectedEmail(argument: string) {
  const email = argument.slice(argument.indexOf("=") + 1).trim().toLowerCase();
  if (!email || !email.includes("@")) {
    throw new Error("Selectorul contului demo trebuie să conțină o adresă de email.");
  }
  return email;
}

export function assertLocalDemoDatabase(
  databaseUrl: string | undefined,
  nodeEnvironment: string | undefined,
) {
  if (!databaseUrl) throw new Error("DATABASE_URL nu este definit.");
  if (nodeEnvironment === "production") {
    throw new Error("Seed-ul demo nu poate rula cu NODE_ENV=production.");
  }

  let parsed: URL;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new Error("DATABASE_URL nu este un URL PostgreSQL valid.");
  }
  const localHosts = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);
  if (
    !["postgres:", "postgresql:"].includes(parsed.protocol) ||
    !localHosts.has(parsed.hostname)
  ) {
    throw new Error("Seed-ul demo acceptă doar o bază PostgreSQL locală.");
  }
}
