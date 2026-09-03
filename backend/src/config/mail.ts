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
 *
 * Explicit, short timeouts are required here: nodemailer's own defaults
 * (2 min connection, 10 min socket) are far longer than the HTTP
 * gateway/reverse-proxy sitting in front of this API, whose timeout fires
 * first — so a real connection failure (wrong host, blocked outbound port,
 * unreachable server) surfaces as an opaque 504 Gateway Timeout instead of
 * the actual SMTP error. Bounding these to ~10s means a bad config fails
 * fast with a real, catchable error message instead of hanging.
 */
export function createTransporter(config: SmtpConfig) {
  const options = {
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.pass },
    family: 4,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  } as SMTPTransport.Options;

  return nodemailer.createTransport(options);
}
