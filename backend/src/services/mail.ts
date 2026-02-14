import { mailTransporter } from "../config/mail";

export const sendEmail = async ({ to, subject, html, text }) => {
  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to,
    subject,
    text,
    html,
  };

  return await mailTransporter.sendMail(mailOptions);
};