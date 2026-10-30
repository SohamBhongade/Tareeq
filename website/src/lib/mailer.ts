import "server-only";
import nodemailer, { type Transporter } from "nodemailer";

/**
 * Sends Tareeq's emails through a Gmail account.
 *
 * .env.local:
 *   GMAIL_USER=tareeq.hackathon@gmail.com
 *   GMAIL_APP_PASSWORD=abcd efgh ijkl mnop   ← a Google "App Password", not the normal password
 *
 * Without these, nothing is emailed: the code is printed in the terminal and
 * shown on screen instead (demo mode), so sign-up can still be tested.
 */

const user = () => process.env.GMAIL_USER?.trim() || "";
const pass = () => (process.env.GMAIL_APP_PASSWORD ?? "").replace(/\s+/g, "");

export function mailConfigured(): boolean {
  return !!(user() && pass());
}

let transport: Transporter | null = null;
function mailer(): Transporter {
  transport ??= nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user: user(), pass: pass() },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });
  return transport;
}

export class MailError extends Error {
  constructor(public userMessage: string) {
    super(userMessage);
    this.name = "MailError";
  }
}

type Kind = "signup" | "reset";
type MailLang = "en" | "ar";

const COPY: Record<MailLang, Record<Kind, { subject: (code: string) => string; heading: string; lead: string }> & {
  hi: (name: string) => string; expires: string; footer: string; yourCode: string;
}> = {
  en: {
    signup: {
      subject: (code) => `${code} is your Tareeq code`,
      heading: "Confirm your email",
      lead: "Welcome to Tareeq! Enter this code to finish creating your account.",
    },
    reset: {
      subject: (code) => `${code} is your Tareeq password reset code`,
      heading: "Reset your password",
      lead: "Someone (hopefully you) asked to reset the password for this email. Enter this code to choose a new one.",
    },
    hi: (name) => `Hi ${name}, `,
    expires: "The code works for 10 minutes. If you didn't ask for it, you can ignore this email.",
    footer: "Tareeq · Civic intelligence for Ras Al Khaimah",
    yourCode: "Your code",
  },
  ar: {
    signup: {
      subject: (code) => `رمزك في طريق: ${code}`,
      heading: "أكّد بريدك الإلكتروني",
      lead: "مرحباً بك في طريق! أدخل هذا الرمز لإكمال إنشاء حسابك.",
    },
    reset: {
      subject: (code) => `رمز إعادة تعيين كلمة المرور في طريق: ${code}`,
      heading: "إعادة تعيين كلمة المرور",
      lead: "طلب أحدهم (نأمل أن تكون أنت) إعادة تعيين كلمة المرور لهذا البريد. أدخل هذا الرمز لاختيار كلمة جديدة.",
    },
    hi: (name) => `مرحباً ${name}، `,
    expires: "الرمز صالح لمدة 10 دقائق. إذا لم تطلبه، يمكنك تجاهل هذه الرسالة.",
    footer: "طريق · ذكاء مدني لرأس الخيمة",
    yourCode: "رمزك",
  },
};

function html(lang: MailLang, kind: Kind, code: string, name?: string) {
  const L = COPY[lang];
  const c = L[kind];
  const rtl = lang === "ar";
  const digits = code
    .split("")
    .map(
      (d) =>
        `<td style="width:44px;height:54px;background:#f4f4f2;border-radius:12px;text-align:center;font:600 28px/54px 'DM Sans',Arial,sans-serif;color:#292928">${d}</td><td style="width:8px"></td>`,
    )
    .join("");
  return `<!doctype html><html lang="${lang}" dir="${rtl ? "rtl" : "ltr"}"><body style="margin:0;background:#f1f1ef;padding:32px 12px;font-family:'DM Sans',Tahoma,Arial,sans-serif;color:#292928">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background:#ffffff;border-radius:24px;overflow:hidden" dir="${rtl ? "rtl" : "ltr"}">
      <tr><td style="background:#292928;padding:22px 28px;text-align:${rtl ? "right" : "left"}">
        <span style="font:600 22px Arial,sans-serif;color:#ffffff">Tareeq</span>
        <span style="font:600 20px Tahoma,Arial,sans-serif;color:#c3f832;padding:0 8px">طريق</span>
      </td></tr>
      <tr><td style="padding:30px 28px 8px;text-align:${rtl ? "right" : "left"}">
        <div style="font-size:22px;font-weight:600">${c.heading}</div>
        <p style="margin:10px 0 22px;font-size:14px;line-height:1.7;color:#5c5c59">${name ? L.hi(escapeHtml(name)) : ""}${c.lead}</p>
        <table role="presentation" cellpadding="0" cellspacing="0" dir="ltr"${rtl ? ' align="right"' : ""}><tr>${digits}</tr></table>
        <p style="clear:both;margin:22px 0 0;font-size:13px;color:#8b8b87">${L.expires}</p>
      </td></tr>
      <tr><td style="padding:24px 28px 28px;font-size:12px;color:#b6b6b1;text-align:${rtl ? "right" : "left"}">${L.footer}</td></tr>
    </table>
  </td></tr></table></body></html>`;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);
}

/** Emails a 6-digit code. Returns false when email isn't set up (demo mode). */
export async function sendCode(to: string, kind: Kind, code: string, name?: string, lang: MailLang = "en"): Promise<boolean> {
  if (!mailConfigured()) {
    console.log(`[mail] Email not set up (GMAIL_USER / GMAIL_APP_PASSWORD). ${kind} code for ${to}: ${code}`);
    return false;
  }
  try {
    await mailer().sendMail({
      from: `"Tareeq" <${user()}>`,
      to,
      subject: COPY[lang][kind].subject(code),
      text: `${COPY[lang][kind].heading}\n\n${COPY[lang][kind].lead}\n\n${COPY[lang].yourCode}: ${code}\n\n${COPY[lang].expires}`,
      html: html(lang, kind, code, name),
    });
    return true;
  } catch (e) {
    const msg = String((e as Error)?.message ?? e);
    console.error("[mail] sending failed:", msg);
    if (/Invalid login|Username and Password not accepted|EAUTH|535/i.test(msg)) {
      throw new MailError("The site's email login was refused. Check GMAIL_USER and GMAIL_APP_PASSWORD in .env.local.");
    }
    throw new MailError("We couldn't send the email right now. Please try again in a minute.");
  }
}
