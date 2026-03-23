import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const DEFAULT_FROM = "Agente OVNI <asistente@ovnistudio.com.ar>";

interface EmailData {
  to: string;
  subject: string;
  html: string;
}

async function sendEmail({ to, subject, html }: EmailData) {
  try {
    console.log(`📧 [EMAIL] Intentando enviar a: ${to} | Asunto: ${subject}`);
    const result = await resend.emails.send({
      from: DEFAULT_FROM,
      to,
      subject,
      html,
    });
    console.log(`✅ [EMAIL] Enviado con éxito. ID: ${result.data?.id}`);
    return result;
  } catch (error) {
    console.error("❌ [EMAIL] ERROR CRÍTICO AL ENVIAR:", error);
    throw error;
  }
}

function getEmailTemplate(content: string, title?: string) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #7c5cfc, #22d3ee); padding: 30px; text-align: center; }
    .header h1 { color: white; margin: 0; font-size: 24px; }
    .content { padding: 30px; }
    .content h2 { color: #333; margin-top: 0; }
    .info-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    .info-table td { padding: 10px; border-bottom: 1px solid #eee; }
    .info-table td:first-child { font-weight: bold; color: #666; width: 120px; }
    .btn { display: inline-block; padding: 12px 24px; background: #7c5cfc; color: white; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 5px; }
    .btn-secondary { background: #e0e0e0; color: #333; }
    .footer { padding: 20px 30px; background: #f9f9f9; text-align: center; font-size: 12px; color: #999; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${title || "Agente OVNI"}</h1>
    </div>
    <div class="content">
      ${content}
    </div>
    <div class="footer">
      <p>收到的邮件发自 Agente OVNI</p>
    </div>
  </div>
</body>
</html>
  `;
}

export async function sendMeetingRequestToAdmin(adminEmail: string, meetingData: {
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  date: string;
  time: string;
  topic?: string;
  meetingId?: string;
}) {
  const formattedDate = new Date(`${meetingData.date}T${meetingData.time}`).toLocaleString("es-AR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
    timeZone: "America/Argentina/Buenos_Aires",
  });

  const confirmUrl = meetingData.meetingId 
    ? `${process.env.APP_URL}/api/meetings/${meetingData.meetingId}/confirm`
    : `${process.env.APP_URL}/api/meetings/confirm?id=${meetingData.customerEmail}`;
  const rejectUrl = meetingData.meetingId
    ? `${process.env.APP_URL}/api/meetings/${meetingData.meetingId}/reject`
    : `${process.env.APP_URL}/api/meetings/reject?id=${meetingData.customerEmail}`;

  const content = `
    <h2>Nueva Solicitud de Reunión</h2>
    <p>Un cliente solicitó una reunión. Por favor confirmá o rechazá.</p>
    <table class="info-table">
      <tr><td>Cliente:</td><td>${meetingData.customerName}</td></tr>
      <tr><td>Email:</td><td>${meetingData.customerEmail}</td></tr>
      <tr><td>Teléfono:</td><td>${meetingData.customerPhone || "No proporcionado"}</td></tr>
      <tr><td>Fecha:</td><td>${formattedDate}</td></tr>
      <tr><td>Motivo:</td><td>${meetingData.topic || "Consulta General"}</td></tr>
    </table>
    <div style="text-align: center; margin-top: 20px;">
      <a href="${confirmUrl}" class="btn">✅ Confirmar</a>
      <a href="${rejectUrl}" class="btn btn-secondary">❌ Rechazar</a>
    </div>
  `;

  return sendEmail({
    to: adminEmail,
    subject: `📅 Nueva Solicitud de Reunión - ${meetingData.customerName}`,
    html: getEmailTemplate(content, "Nueva Reunión Solicitada"),
  });
}

export async function sendMeetingConfirmationToUser(
  customerEmail: string,
  meetingData: {
    customerName: string;
    date: string;
    time: string;
    topic?: string;
  }
) {
  const formattedDate = new Date(`${meetingData.date}T${meetingData.time}`).toLocaleString("es-AR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
    timeZone: "America/Argentina/Buenos_Aires",
  });

  const content = `
    <h2>¡Tu reunión fue confirmada! 🎉</h2>
    <p>Hola ${meetingData.customerName}, tu reunión ha sido confirmada.</p>
    <table class="info-table">
      <tr><td>Fecha:</td><td>${formattedDate}</td></tr>
      <tr><td>Motivo:</td><td>${meetingData.topic || "Consulta General"}</td></tr>
    </table>
    <p>Recibirás un recordatorio antes de la reunión.</p>
  `;

  return sendEmail({
    to: customerEmail,
    subject: "✅ Tu reunión fue confirmada",
    html: getEmailTemplate(content, "Reunión Confirmada"),
  });
}

export async function sendMeetingCancellationToUser(
  customerEmail: string,
  meetingData: {
    customerName: string;
    date: string;
    time: string;
  }
) {
  const formattedDate = new Date(`${meetingData.date}T${meetingData.time}`).toLocaleString("es-AR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "America/Argentina/Buenos_Aires",
  });

  const content = `
    <h2>Reunión Cancelada</h2>
    <p>Hola ${meetingData.customerName}, lamentamos informarte que tu reunión del ${formattedDate} ha sido cancelada.</p>
    <p>Si wishés reprogramar, no dudes en contactarnos.</p>
  `;

  return sendEmail({
    to: customerEmail,
    subject: "❌ Reunión Cancelada",
    html: getEmailTemplate(content, "Reunión Cancelada"),
  });
}
