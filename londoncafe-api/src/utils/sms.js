// src/utils/sms.js
//
// Verificación por SMS (Twilio) -- reemplaza el correo como canal de
// verificación en el registro (decisión del dueño: menos fricción, ya se
// pide el teléfono de todos modos). Un solo cliente reusado para todo el
// proceso, igual que el transporter de email.js.
const twilio = require("twilio");

let _client = null;
function getClient() {
  if (_client) return _client;
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) throw new Error("TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN faltan en .env");
  _client = twilio(sid, token);
  return _client;
}

async function sendVerificationSms({ to, code }) {
  const client = getClient();
  const from = process.env.TWILIO_FROM_NUMBER;
  if (!from) throw new Error("TWILIO_FROM_NUMBER falta en .env");

  await client.messages.create({
    body: `London Café: tu código de verificación es ${code}. Expira en 10 minutos.`,
    from,
    to,
  });
}

module.exports = { sendVerificationSms };
