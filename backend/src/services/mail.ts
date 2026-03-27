import nodemailer from "nodemailer";

interface SendEmailOptions {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  transporter?: nodemailer.Transporter;
  fromAddress?: string;
}

export const sendEmail = async ({
  to,
  subject,
  html,
  text,
  transporter: externalTransporter,
  fromAddress,
}: SendEmailOptions) => {
  const t = externalTransporter ?? nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
  const from = fromAddress ?? process.env.SMTP_FROM ?? process.env.SMTP_USER ?? '';
  return await t.sendMail({ from, to, subject, text, html });
};
