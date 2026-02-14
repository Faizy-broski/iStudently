import nodemailer from "nodemailer";

export const mailTransporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: process.env.EMAIL_SECURE === "true",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export const verifyMailer = async () => {
  await mailTransporter.verify();
  console.log("📧 Mail server is ready");
};