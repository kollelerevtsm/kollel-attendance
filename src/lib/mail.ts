import nodemailer from "nodemailer";

/** Sends an email through the Gmail (or other SMTP) account set in Vercel. */
export async function sendMail(to: string, subject: string, text: string, html: string) {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!user || !pass) throw new Error("Email isn't set up yet (SMTP_USER / SMTP_PASS missing in Vercel).");
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: Number(process.env.SMTP_PORT ?? 587) === 465,
    auth: { user, pass },
  });
  await transport.sendMail({ from: `"Kollel Erev" <${process.env.MAIL_FROM ?? user}>`, to, subject, text, html });
}
