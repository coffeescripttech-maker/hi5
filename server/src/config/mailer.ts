import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

/**
 * Gmail SMTP transport for transactional email (password reset links).
 *
 * Requires a Gmail account with 2-Step Verification enabled and an App
 * Password (Google Account -> Security -> App passwords). NEVER use the raw
 * account password here.
 *
 * Env vars:
 *   GMAIL_USER           - the Gmail address that sends the mail
 *   GMAIL_APP_PASSWORD   - the 16-char App Password (no spaces)
 *   GMAIL_FROM_NAME      - optional display name, default "HI5 Portal"
 *   SMTP_HOST / SMTP_PORT - optional overrides (defaults smtp.gmail.com:465)
 *
 * NOTE: env is read lazily (per call), NOT at module scope. index.ts calls
 * dotenv.config() AFTER the controllers/mailer are imported, so capturing
 * process.env at import time would always see empty Gmail vars in dev.
 */

interface MailConfig {
  user: string;
  pass: string;
  fromName: string;
}

function mailConfig(): MailConfig {
  return {
    user: process.env.GMAIL_USER || "",
    pass: process.env.GMAIL_APP_PASSWORD || "",
    fromName: process.env.GMAIL_FROM_NAME || "HI5 Portal",
  };
}

export function isMailConfigured(): boolean {
  const { user, pass } = mailConfig();
  return Boolean(user && pass);
}

let transport: Transporter | null = null;

function getTransport(): Transporter {
  if (!isMailConfigured()) {
    throw new Error(
      "SMTP mail is not configured. Set GMAIL_USER and GMAIL_APP_PASSWORD."
    );
  }
  if (!transport) {
    const cfg = mailConfig();
    const port = parseInt(process.env.SMTP_PORT || "465", 10);
    transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port,
      // 465 = implicit TLS; anything else (587 etc.) uses STARTTLS instead.
      secure: port === 465,
      auth: { user: cfg.user, pass: cfg.pass },
      connectionTimeout: 15_000,
      greetingTimeout: 15_000,
      socketTimeout: 30_000,
    });
    // Log once so deployments can verify which endpoint is being dialed
    // (connectivity failures usually show up here before auth does).
    console.log(
      `[mailer] SMTP transport ready -> ${process.env.SMTP_HOST || "smtp.gmail.com"}:${port} (${port === 465 ? "implicit TLS" : "STARTTLS"})`
    );
  }
  return transport;
}

/**
 * Email a one-time password-reset link. Throws with a descriptive error if
 * the SMTP server rejects the message (caller decides how to respond).
 */
export async function sendPasswordResetEmail(
  to: string,
  resetLink: string,
  expiresMinutes = 15
): Promise<void> {
  const transporter = getTransport();
  const cfg = mailConfig();
  await transporter.sendMail({
    from: `"${cfg.fromName}" <${cfg.user}>`,
    to,
    subject: "Reset your HI5 Portal password",
    text: [
      "You requested a password reset for your HI5 Portal account.",
      "",
      `Open this link to choose a new password: ${resetLink}`,
      "",
      `The link expires in ${expiresMinutes} minutes.`,
      "",
      "If you did not request this, you can safely ignore this email.",
      "- HI5 Portal",
    ].join("\n"),
    html: `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;">
    <div style="max-width:440px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
      <div style="background:linear-gradient(135deg,#059669,#0d9488);padding:20px 24px;">
        <div style="color:#ffffff;font-size:15px;font-weight:bold;">HI5 Portal</div>
        <div style="color:#d1fae5;font-size:12px;margin-top:2px;">Don Servillano Platon Memorial National High School</div>
      </div>
      <div style="padding:24px;">
        <p style="margin:0 0 12px;color:#374151;font-size:14px;line-height:1.5;">
          You requested a password reset for your account.
        </p>
        <p style="margin:0 0 16px;color:#374151;font-size:14px;line-height:1.5;">
          Click the button below to choose a new password:
        </p>
        <div style="text-align:center;margin:12px 0;">
          <a href="${resetLink}" style="display:inline-block;background:#059669;color:#ffffff;text-decoration:none;font-weight:bold;font-size:14px;padding:12px 24px;border-radius:10px;">Reset your password</a>
        </div>
        <p style="margin:0 0 12px;color:#6b7280;font-size:12px;line-height:1.5;word-break:break-all;">
          Or copy this link: ${resetLink}
        </p>
        <p style="margin:0 0 12px;color:#374151;font-size:14px;line-height:1.5;">
          The link expires in ${expiresMinutes} minutes.
        </p>
        <p style="margin:0;color:#9ca3af;font-size:12px;line-height:1.5;">
          If you did not request this, you can safely ignore this email.
        </p>
      </div>
    </div>
  </body>
</html>`,
  });
}
