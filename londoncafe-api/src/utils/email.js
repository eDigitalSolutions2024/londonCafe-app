const nodemailer = require("nodemailer");

function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT || 587),
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
}

async function sendVerificationEmail({ to, code }) {
  const transporter = createTransporter();

  // ✅ DEBUG: verificar conexión SMTP
  await transporter.verify();
  console.log("✅ SMTP OK (verify) - sending to:", to);

  const appName = process.env.APP_NAME || "App";
  const from = process.env.EMAIL_FROM || process.env.EMAIL_USER;

  const subject = `${appName} - Código de verificación`;
  const text = `Tu código de verificación es: ${code}\n\nExpira en 10 minutos.`;

  const info = await transporter.sendMail({
    from,
    to,
    subject,
    text,
  });

  console.log("✅ Email sent:", info.messageId);
}

module.exports = { sendVerificationEmail };
