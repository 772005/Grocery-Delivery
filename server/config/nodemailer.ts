import { createTransport } from "nodemailer";
import { text } from "stream/iter";

// Create a transporter using SMTP
const transporter = createTransport({
  host: "smtp-relay.brevo.com",
  port: 587,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const sendEmail = async ({ to, subject, body }: { to: string; subject: string; body: string }) => {
  try {
    const response = await transporter.sendMail({
      from: process.env.SMTP_EMAIL, // Sender email address
      to,
      subject,
      html: body,
    });
    return response;
  } catch (error) {
    console.error("Error sending email:", error);
  }
};

export default sendEmail;