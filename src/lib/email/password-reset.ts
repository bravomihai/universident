import "server-only";

import { Resend } from "resend";

type SendPasswordResetMessageOptions = {
  email: string;
  name: string;
  resetUrl: string;
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

function createPasswordResetEmailText({
  name,
  resetUrl,
}: Omit<SendPasswordResetMessageOptions, "email">) {
  return [
    `Salut, ${name}!`,
    "",
    "Am primit o solicitare de resetare a parolei pentru contul Universident:",
    resetUrl,
    "",
    "Linkul este valabil timp de o oră.",
    "",
    "Dacă nu ai solicitat resetarea parolei, poți ignora acest mesaj. Parola ta nu va fi modificată.",
  ].join("\n");
}

function createPasswordResetEmailHtml({
  name,
  resetUrl,
}: Omit<SendPasswordResetMessageOptions, "email">) {
  const safeName = escapeHtml(name);
  const safeResetUrl = escapeHtml(resetUrl);

  return `<!doctype html>
<html lang="ro">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Resetare parolă pentru Universident</title>
  </head>
  <body style="margin:0;background:#f4f4f5;color:#18181b;font-family:Arial,sans-serif;">
    <div style="margin:0 auto;max-width:600px;padding:32px 16px;">
      <div style="border:1px solid #e4e4e7;border-radius:16px;background:#ffffff;padding:32px;">
        <p style="margin:0 0 16px;font-size:16px;">Salut, ${safeName}!</p>
        <h1 style="margin:0 0 16px;font-size:24px;line-height:1.25;">
          Resetează parola
        </h1>
        <p style="margin:0 0 24px;color:#52525b;font-size:16px;line-height:1.6;">
          Am primit o solicitare de resetare a parolei pentru contul Universident.
        </p>
        <p style="margin:0 0 24px;">
          <a href="${safeResetUrl}" style="display:inline-block;border-radius:10px;background:#18181b;color:#ffffff;padding:12px 18px;text-decoration:none;font-weight:600;">
            Resetează parola
          </a>
        </p>
        <p style="margin:0 0 12px;color:#52525b;font-size:14px;line-height:1.6;">
          Linkul este valabil timp de o oră.
        </p>
        <p style="margin:0;color:#71717a;font-size:13px;line-height:1.6;">
          Dacă nu ai solicitat resetarea parolei, poți ignora acest mesaj. Parola ta nu va fi modificată.
        </p>
      </div>
    </div>
  </body>
</html>`;
}

export async function sendPasswordResetMessage({
  email,
  name,
  resetUrl,
}: SendPasswordResetMessageOptions) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();

  if (!apiKey || !from) {
    throw new Error("EMAIL_DELIVERY_NOT_CONFIGURED");
  }

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from,
    to: email,
    subject: "Resetare parolă pentru Universident",
    html: createPasswordResetEmailHtml({
      name,
      resetUrl,
    }),
    text: createPasswordResetEmailText({
      name,
      resetUrl,
    }),
  });

  if (error) {
    throw new Error("EMAIL_DELIVERY_FAILED");
  }
}
