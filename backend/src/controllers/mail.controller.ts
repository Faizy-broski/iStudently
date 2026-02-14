import { sendEmail } from "../services/mail";

export const sendTestMail = async (req, res) => {
  try {
    const { email } = req.body;

    await sendEmail({
      to: email,
      subject: "Welcome 🎉",
      text: "Welcome to our platform!",
      html: "<h1>Welcome!</h1><p>You’re successfully onboarded.</p>",
    });

    res.status(200).json({
      success: true,
      message: "Email sent successfully",
    });
  } catch (error) {
    console.error("Mail error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to send email",
    });
  }
};
