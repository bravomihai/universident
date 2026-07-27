import "server-only";

import { Resend } from "resend";

type SendEmailVerificationMessageOptions = {
  email: string;
  name: string;
  verificationUrl: string;
};

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character] ?? character,
  );
}

function createVerificationEmailText({
  name,
  verificationUrl,
}: Omit<SendEmailVerificationMessageOptions, "email">) {
  return [
    `Salut, ${name}!`,
    "",
    "Confirmă adresa de email pentru a continua folosirea contului Universident:",
    verificationUrl,
    "",
    "Linkul este valabil timp de o oră.",
    "",
    "Dacă nu ai creat acest cont, poți ignora mesajul.",
  ].join("\n");
}

function createVerificationEmailHtml({
  name,
  verificationUrl,
}: Omit<SendEmailVerificationMessageOptions, "email">) {
  const safeName = escapeHtml(name);
  const safeVerificationUrl = escapeHtml(verificationUrl);

  return `<!doctype html>
<html lang="ro">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Verifică adresa de email</title>
  </head>
  <body style="margin:0;background:#f4f4f5;color:#18181b;font-family:Arial,sans-serif;">
    <div style="margin:0 auto;max-width:600px;padding:32px 16px;">
      <div style="border:1px solid #e4e4e7;border-radius:16px;background:#ffffff;padding:32px;">
        <p style="margin:0 0 16px;font-size:16px;">Salut, ${safeName}!</p>
        <h1 style="margin:0 0 16px;font-size:24px;line-height:1.25;">
          Verifică adresa de email
        </h1>
        <p style="margin:0 0 24px;color:#52525b;font-size:16px;line-height:1.6;">
          Confirmă adresa de email pentru a continua folosirea contului Universident.
        </p>
        <p style="margin:0 0 24px;">
          <a href="${safeVerificationUrl}" style="display:inline-block;border-radius:10px;background:#18181b;color:#ffffff;padding:12px 18px;text-decoration:none;font-weight:600;">
            Verifică adresa de email
          </a>
        </p>
        <p style="margin:0 0 12px;color:#52525b;font-size:14px;line-height:1.6;">
          Linkul este valabil timp de o oră.
        </p>
        <p style="margin:0;color:#71717a;font-size:13px;line-height:1.6;">
          Dacă nu ai creat acest cont, poți ignora mesajul.
        </p>
      </div>
    </div>
  </body>
</html>`;
}

export async function sendEmailVerificationMessage({
  email,
  name,
  verificationUrl,
}: SendEmailVerificationMessageOptions) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();

  if (!apiKey || !from) {
    throw new Error("EMAIL_DELIVERY_NOT_CONFIGURED");
  }

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from,
    to: email,
    subject: "Verifică adresa de email pentru Universident",
    html: createVerificationEmailHtml({
      name,
      verificationUrl,
    }),
    text: createVerificationEmailText({
      name,
      verificationUrl,
    }),
  });

  if (error) {
    throw new Error("EMAIL_DELIVERY_FAILED");
  }
}
