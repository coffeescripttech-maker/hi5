import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

/**
 * Transactional email transport for password reset links.
 *
 * Providers (checked in order):
 *   1. Resend — when RESEND_API_KEY is set. Uses the Resend HTTP API
 *      (https://api.resend.com/emails), no extra dependency.
 *   2. Gmail SMTP — when GMAIL_USER + GMAIL_APP_PASSWORD are set.
 *
 * Env vars:
 *   RESEND_API_KEY      - Resend API key (re_...)
 *   RESEND_FROM         - optional sender "Name <email@verified-domain>" —
 *                         defaults to GMAIL_USER (if set) or onboarding@resend.dev
 *   RESEND_FROM_NAME    - optional display name (default "HI5 Portal")
 *   GMAIL_USER          - Gmail address that sends the mail (SMTP fallback)
 *   GMAIL_APP_PASSWORD  - 16-char Gmail App Password (SMTP fallback)
 *   GMAIL_FROM_NAME     - optional display name, default "HI5 Portal"
 *   SMTP_HOST / SMTP_PORT - optional SMTP overrides (defaults smtp.gmail.com:465)
 *
 * NOTE: env is read lazily (per call), NOT at module scope. index.ts calls
 * dotenv.config() AFTER the controllers/mailer are imported, so capturing
 * process.env at import time would always see empty vars in dev.
 */

function resendConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

function smtpConfigured(): boolean {
  return Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
}

export function isMailConfigured(): boolean {
  return resendConfigured() || smtpConfigured();
}

let transport: Transporter | null = null;

function getTransport(): Transporter {
  if (!smtpConfigured()) {
    throw new Error(
      "SMTP mail is not configured. Set GMAIL_USER and GMAIL_APP_PASSWORD."
    );
  }
  if (!transport) {
    const port = parseInt(process.env.SMTP_PORT || "465", 10);
    transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port,
      // 465 = implicit TLS; anything else (587 etc.) uses STARTTLS instead.
      secure: port === 465,
      auth: { user: process.env.GMAIL_USER!, pass: process.env.GMAIL_APP_PASSWORD! },
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

/** Sender address for Resend — must be a verified domain on resend.com.
 *  gmail.com can never be verified there, so never fall back to GMAIL_USER. */
function resendFrom(): string {
  const override = process.env.RESEND_FROM;
  if (override) return override;
  const fromName = process.env.RESEND_FROM_NAME || process.env.GMAIL_FROM_NAME || "HI5 Portal";
  return `"${fromName}" <onboarding@resend.dev>`;
}

/** Send via the Resend HTTP API (no SDK dependency). */
async function sendViaResend(
  to: string,
  subject: string,
  text: string,
  html: string
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY || "";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: resendFrom(), to, subject, text, html }),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Resend API error ${res.status}: ${detail}`);
  }
}

/**
 * Email a one-time password-reset link. Throws with a descriptive error if
 * the provider rejects the message (caller decides how to respond).
 */
export async function sendPasswordResetEmail(
  to: string,
  resetLink: string,
  expiresMinutes = 15
): Promise<void> {
  if (resendConfigured()) {
    console.log(`[mailer] Sending password reset via Resend to ${to}`);
    await sendViaResend(
      to,
      "Reset your HI5 Portal password",
      [
        "You requested a password reset for your HI5 Portal account.",
        "",
        `Open this link to choose a new password: ${resetLink}`,
        "",
        `The link expires in ${expiresMinutes} minutes.`,
        "",
        "If you did not request this, you can safely ignore this email.",
        "- HI5 Portal",
      ].join("\n"),
      resetHtml(resetLink, expiresMinutes)
    );
    return;
  }

  const transporter = getTransport();
  await transporter.sendMail({
    from: `"${process.env.GMAIL_FROM_NAME || "HI5 Portal"}" <${process.env.GMAIL_USER}>`,
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
    html: resetHtml(resetLink, expiresMinutes),
  });
}

function resetHtml(resetLink: string, expiresMinutes: number): string {
  return `<!doctype html>
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
</html>`;
}
