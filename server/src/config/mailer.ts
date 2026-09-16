import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

/**
 * Gmail SMTP transport for transactional email (password reset codes).
 *
 * Requires a Gmail account with 2-Step Verification enabled and an App
 * Password (Google Account -> Security -> App passwords). NEVER use the
 * raw account password here.
 *
 * Env vars:
 *   GMAIL_USER           - the Gmail address that sends the mail
 *   GMAIL_APP_PASSWORD   - the 16-char App Password (no spaces)
 *   GMAIL_FROM_NAME      - optional display name, default "HI5 Portal"
 *   SMTP_HOST / SMTP_PORT - optional overrides (defaults smtp.gmail.com:465)
 */

const GMAIL_USER = process.env.GMAIL_USER || "";
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD || "";
const FROM_NAME = process.env.GMAIL_FROM_NAME || "HI5 Portal";

export function isMailConfigured(): boolean {
  return Boolean(GMAIL_USER && GMAIL_APP_PASSWORD);
}

let transport: Transporter | null = null;

function getTransport(): Transporter {
  if (!isMailConfigured()) {
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
      auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
      connectionTimeout: 15_000,
      greetingTimeout: 15_000,
      socketTimeout: 30_000,
    });
  }
  return transport;
}

/**
 * Email a 6-digit password-reset code. Throws with a descriptive error if
 * the SMTP server rejects the message (caller decides how to respond).
 */
export async function sendPasswordResetEmail(
  to: string,
  code: string,
  expiresMinutes = 15
): Promise<void> {
  const transporter = getTransport();
  await transporter.sendMail({
    from: `"${FROM_NAME}" <${GMAIL_USER}>`,
    to,
    subject: "Your HI5 Portal password reset code",
    text: [
      "You requested a password reset for your HI5 Portal account.",
      "",
      `Your reset code is: ${code}`,
      `It expires in ${expiresMinutes} minutes.`,
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
        <div style="text-align:center;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:10px;padding:14px;margin:12px 0;">
          <div style="color:#065f46;font-size:11px;letter-spacing:1px;text-transform:uppercase;margin-bottom:6px;">Your reset code</div>
          <div style="font-family:monospace;font-size:28px;font-weight:bold;letter-spacing:8px;color:#047857;">${code}</div>
        </div>
        <p style="margin:0 0 12px;color:#374151;font-size:14px;line-height:1.5;">
          Enter this code on the login page. It expires in ${expiresMinutes} minutes.
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
