const nodemailer = require("nodemailer");

function createTransporter() {
  const port = Number(process.env.EMAIL_PORT || 587);
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port,
    // 465 es TLS implícito (secure:true) -- 587/25 usan STARTTLS sobre una
    // conexión que arranca en plano (secure:false). Antes esto estaba fijo
    // en false porque solo se había usado 587 (Gmail); el buzón nuevo en
    // cPanel (mail.londoncafejrz.com) usa 465, así que necesita secure:true.
    secure: port === 465,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
}

// Antes esto era texto plano puro, sin HTML, mandado desde una cuenta de
// Gmail personal por SMTP -- eso, además de la falta de SPF/DKIM/DMARC en
// el dominio real de envío, es una causa muy conocida de que el correo
// caiga en spam: los filtros desconfían de correos automatizados,
// solo-texto, sin ningún branding, saliendo de una cuenta @gmail.com.
// Este cambio no arregla la autenticación del dominio (eso requiere mover
// EMAIL_HOST/EMAIL_USER a un remitente en un dominio propio con SPF/DKIM/
// DMARC configurados -- ver notas de deploy), pero sí corrige lo que sí
// depende del código: manda HTML + texto (multipart/alternative, lo que
// esperan los filtros de un correo transaccional legítimo) con branding
// real, en vez de texto plano suelto.
function buildVerificationEmail({ code, name, appName }) {
  const greeting = name ? `Hola, ${name}:` : "Hola:";
  const text = [
    greeting,
    "",
    `Tu código de verificación de ${appName} es: ${code}`,
    "",
    "Expira en 10 minutos.",
    "",
    "Si no creaste esta cuenta, ignora este correo -- no se requiere ninguna acción de tu parte.",
    "",
    `${appName}`,
  ].join("\n");

  const html = `
<!doctype html>
<html lang="es">
  <body style="margin:0;padding:0;background-color:#f4f4f5;font-family:Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:420px;background-color:#ffffff;border-radius:12px;overflow:hidden;">
            <tr>
              <td style="background-color:#111827;padding:20px 28px;">
                <span style="color:#ffffff;font-size:18px;font-weight:700;">${appName}</span>
              </td>
            </tr>
            <tr>
              <td style="padding:28px;">
                <p style="margin:0 0 12px;color:#111827;font-size:15px;">${greeting}</p>
                <p style="margin:0 0 20px;color:#374151;font-size:15px;line-height:1.5;">
                  Tu código de verificación es:
                </p>
                <div style="margin:0 0 20px;text-align:center;">
                  <span style="display:inline-block;padding:14px 28px;background-color:#f4f4f5;border-radius:8px;font-size:28px;font-weight:700;letter-spacing:6px;color:#111827;">
                    ${code}
                  </span>
                </div>
                <p style="margin:0 0 16px;color:#6b7280;font-size:13px;">
                  Expira en 10 minutos.
                </p>
                <p style="margin:0;color:#9ca3af;font-size:12px;line-height:1.5;">
                  Si no creaste esta cuenta, ignora este correo -- no se requiere ninguna acción de tu parte.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 28px;background-color:#f9fafb;border-top:1px solid #e5e7eb;">
                <p style="margin:0;color:#9ca3af;font-size:11px;">${appName}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`.trim();

  return { text, html };
}

async function sendVerificationEmail({ to, code, name }) {
  const transporter = createTransporter();

  // ✅ DEBUG: verificar conexión SMTP
  await transporter.verify();
  console.log("✅ SMTP OK (verify) - sending to:", to);

  const appName = process.env.APP_NAME || "App";
  const from = process.env.EMAIL_FROM || process.env.EMAIL_USER;

  const subject = `${appName} - Código de verificación`;
  const { text, html } = buildVerificationEmail({ code, name, appName });

  const info = await transporter.sendMail({
    from,
    to,
    subject,
    text,
    html,
  });

  console.log("✅ Email sent:", info.messageId);
}

// Mismo template que buildVerificationEmail (mismo código ya probado contra
// spam), solo cambia el copy para dejar claro que es un reset de contraseña
// y qué hacer si el usuario no lo pidió.
function buildPasswordResetEmail({ code, name, appName }) {
  const greeting = name ? `Hola, ${name}:` : "Hola:";
  const text = [
    greeting,
    "",
    `Tu código para restablecer tu contraseña de ${appName} es: ${code}`,
    "",
    "Expira en 10 minutos.",
    "",
    "Si no pediste este cambio, ignora este correo -- tu contraseña actual sigue funcionando, no se requiere ninguna acción de tu parte.",
    "",
    `${appName}`,
  ].join("\n");

  const html = `
<!doctype html>
<html lang="es">
  <body style="margin:0;padding:0;background-color:#f4f4f5;font-family:Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:420px;background-color:#ffffff;border-radius:12px;overflow:hidden;">
            <tr>
              <td style="background-color:#111827;padding:20px 28px;">
                <span style="color:#ffffff;font-size:18px;font-weight:700;">${appName}</span>
              </td>
            </tr>
            <tr>
              <td style="padding:28px;">
                <p style="margin:0 0 12px;color:#111827;font-size:15px;">${greeting}</p>
                <p style="margin:0 0 20px;color:#374151;font-size:15px;line-height:1.5;">
                  Tu código para restablecer tu contraseña es:
                </p>
                <div style="margin:0 0 20px;text-align:center;">
                  <span style="display:inline-block;padding:14px 28px;background-color:#f4f4f5;border-radius:8px;font-size:28px;font-weight:700;letter-spacing:6px;color:#111827;">
                    ${code}
                  </span>
                </div>
                <p style="margin:0 0 16px;color:#6b7280;font-size:13px;">
                  Expira en 10 minutos.
                </p>
                <p style="margin:0;color:#9ca3af;font-size:12px;line-height:1.5;">
                  Si no pediste este cambio, ignora este correo -- tu contraseña actual sigue funcionando, no se requiere ninguna acción de tu parte.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 28px;background-color:#f9fafb;border-top:1px solid #e5e7eb;">
                <p style="margin:0;color:#9ca3af;font-size:11px;">${appName}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`.trim();

  return { text, html };
}

async function sendPasswordResetEmail({ to, code, name }) {
  const transporter = createTransporter();

  await transporter.verify();
  console.log("✅ SMTP OK (verify) - sending password reset to:", to);

  const appName = process.env.APP_NAME || "App";
  const from = process.env.EMAIL_FROM || process.env.EMAIL_USER;

  const subject = `${appName} - Código para restablecer tu contraseña`;
  const { text, html } = buildPasswordResetEmail({ code, name, appName });

  const info = await transporter.sendMail({
    from,
    to,
    subject,
    text,
    html,
  });

  console.log("✅ Email sent:", info.messageId);
}

module.exports = { sendVerificationEmail, sendPasswordResetEmail };
