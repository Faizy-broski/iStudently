import nodemailer from "nodemailer";

interface SendEmailOptions {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  transporter: nodemailer.Transporter;
  fromAddress: string;
}

export const sendEmail = async ({
  to,
  subject,
  html,
  text,
  transporter,
  fromAddress,
}: SendEmailOptions) => {
  return await transporter.sendMail({ from: fromAddress, to, subject, text, html });
};
