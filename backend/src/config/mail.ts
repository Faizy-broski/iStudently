import nodemailer from "nodemailer";
import SMTPTransport from "nodemailer/lib/smtp-transport";

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
}

/**
 * Create a nodemailer transporter from explicit SMTP config.
 * No env-var fallback — each school must configure their own settings
 * via Settings > Plugins > Email SMTP.
 */
export function createTransporter(config: SmtpConfig) {
  const options = {
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.pass },
    family: 4,
  } as SMTPTransport.Options;

  return nodemailer.createTransport(options);
}
