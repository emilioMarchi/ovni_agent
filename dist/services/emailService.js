import { Resend } from "resend";
const resend = new Resend(process.env.RESEND_API_KEY);
const DEFAULT_FROM = "Agente OVNI <asistente@ovnistudio.com.ar>";
const APP_URL = process.env.APP_URL || "http://localhost:8080";
async function sendEmail({ to, subject, html }) {
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
    }
    catch (error) {
        console.error("❌ [EMAIL] ERROR CRÍTICO AL ENVIAR:", error);
        throw error;
    }
}
function getDarkEmailTemplate(content, title) {
    const logoUrl = `${APP_URL}/logo.png`;
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background: #121212; color: #e0e0e0; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 40px auto; background: #1e1e1e; border-radius: 8px; overflow: hidden; box-shadow: 0 8px 30px rgba(0,0,0,0.5); border: 1px solid #333; }
    .header { padding: 40px 20px; text-align: center; border-bottom: 1px solid #333; background: #1a1a1a; }
    .logo { height: 50px; margin-bottom: 15px; }
    .brand-name { font-size: 14px; letter-spacing: 4px; text-transform: uppercase; color: #888; margin: 0; font-weight: 600; }
    .content { padding: 40px 30px; line-height: 1.6; font-size: 16px; color: #ccc; }
    .content h2 { color: #fff; margin-top: 0; font-weight: 400; font-size: 24px; margin-bottom: 20px; }
    .info-box { background: #252525; padding: 20px; border-radius: 6px; margin: 25px 0; border-left: 4px solid #7c5cfc; }
    .info-row { display: flex; justify-content: space-between; margin-bottom: 10px; border-bottom: 1px solid #333; padding-bottom: 5px; }
    .info-row:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
    .info-label { font-weight: bold; color: #888; font-size: 14px; }
    .info-value { color: #fff; text-align: right; font-size: 14px; }
    .btn { display: inline-block; padding: 14px 28px; background: #7c5cfc; color: white; text-decoration: none; border-radius: 6px; font-weight: 500; margin: 10px 5px; transition: background 0.3s; }
    .btn:hover { background: #6344e6; }
    .btn-secondary { background: #333; color: #ccc; }
    .btn-secondary:hover { background: #444; color: #fff; }
    .footer { padding: 30px; background: #121212; text-align: center; font-size: 12px; color: #555; border-top: 1px solid #333; }
    .highlight { color: #7c5cfc; font-weight: bold; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <img src="${logoUrl}" alt="OVNI Logo" class="logo">
      <p class="brand-name">OVNI STUDIO</p>
    </div>
    <div class="content">
      ${content}
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} OVNISTUDIO. Todos los derechos reservados.</p>
      <p>Este es un mensaje automático generado por tu Agente IA.</p>
    </div>
  </div>
</body>
</html>
  `;
}
function formatDate(date, time) {
    return new Date(`${date}T${time}`).toLocaleString("es-AR", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZoneName: "short",
        timeZone: "America/Argentina/Buenos_Aires",
    });
}
/**
 * Notifica al usuario que su solicitud fue recibida (Paso 1).
 */
export async function sendRequestReceivedToUser(customerEmail, meetingData) {
    const formattedDate = formatDate(meetingData.date, meetingData.time);
    const content = `
    <h2>Solicitud Recibida</h2>
    <p>Hola <strong>${meetingData.customerName}</strong>,</p>
    <p>Hemos recibido tu solicitud de reunión. Nuestro equipo revisará la disponibilidad y te confirmará a la brevedad.</p>
    
    <div class="info-box">
      <div class="info-row"><span class="info-label">Fecha solicitada</span><span class="info-value">${formattedDate}</span></div>
      <div class="info-row"><span class="info-label">Motivo</span><span class="info-value">${meetingData.topic || "Consulta General"}</span></div>
      <div class="info-row"><span class="info-label">Estado</span><span class="info-value" style="color: #fbbf24;">⏳ Pendiente de confirmación</span></div>
    </div>

    <p>Te enviaremos otro correo cuando la reunión sea confirmada con los detalles de acceso.</p>
  `;
    return sendEmail({
        to: customerEmail,
        subject: "⏳ Solicitud de Reunión Recibida - OVNISTUDIO",
        html: getDarkEmailTemplate(content),
    });
}
/**
 * Notifica al admin para que confirme o rechace (Paso 2).
 */
export async function sendMeetingRequestToAdmin(adminEmail, meetingData) {
    const formattedDate = formatDate(meetingData.date, meetingData.time);
    const confirmUrl = meetingData.meetingId
        ? `${APP_URL}/api/meetings/${meetingData.meetingId}/confirm`
        : "#";
    const rejectUrl = meetingData.meetingId
        ? `${APP_URL}/api/meetings/${meetingData.meetingId}/reject`
        : "#";
    const content = `
    <h2>Nueva Solicitud de Reunión</h2>
    <p>Un cliente ha solicitado una reunión a través del agente. Requiere tu acción.</p>
    
    <div class="info-box">
      <div class="info-row"><span class="info-label">Cliente</span><span class="info-value">${meetingData.customerName}</span></div>
      <div class="info-row"><span class="info-label">Email</span><span class="info-value"><a href="mailto:${meetingData.customerEmail}" style="color: #7c5cfc;">${meetingData.customerEmail}</a></span></div>
      <div class="info-row"><span class="info-label">Teléfono</span><span class="info-value">${meetingData.customerPhone || "No proporcionado"}</span></div>
      <div class="info-row"><span class="info-label">Fecha</span><span class="info-value">${formattedDate}</span></div>
      <div class="info-row"><span class="info-label">Motivo</span><span class="info-value">${meetingData.topic || "Consulta General"}</span></div>
    </div>

    <div style="text-align: center; margin-top: 30px;">
      <a href="${confirmUrl}" class="btn">✅ Confirmar Reunión</a>
      <a href="${rejectUrl}" class="btn btn-secondary">❌ Rechazar</a>
    </div>
    <p style="text-align: center; font-size: 12px; color: #666; margin-top: 10px;">
      Al confirmar, se creará el evento en Calendar y se notificará al cliente.
    </p>
  `;
    return sendEmail({
        to: adminEmail,
        subject: `📅 Nueva Solicitud: ${meetingData.customerName}`,
        html: getDarkEmailTemplate(content),
    });
}
/**
 * Notifica al usuario de la confirmación final (Paso 3).
 */
export async function sendMeetingConfirmationToUser(customerEmail, meetingData) {
    const formattedDate = formatDate(meetingData.date, meetingData.time);
    const calendarButton = meetingData.eventLink
        ? `<div style="text-align: center; margin-top: 30px;">
         <a href="${meetingData.eventLink}" class="btn">📅 Aceptar Invitación en Calendar</a>
         <p style="font-size: 13px; color: #888; margin-top: 10px;">Importante: Hacé click arriba para bloquear tu agenda.</p>
       </div>`
        : "";
    const content = `
    <h2>¡Reunión Confirmada! 🎉</h2>
    <p>Hola <strong>${meetingData.customerName}</strong>,</p>
    <p>Tu reunión ha sido confirmada oficialmente. Ya hemos reservado el espacio para vos.</p>
    
    <div class="info-box">
      <div class="info-row"><span class="info-label">Fecha</span><span class="info-value">${formattedDate}</span></div>
      <div class="info-row"><span class="info-label">Motivo</span><span class="info-value">${meetingData.topic || "Consulta General"}</span></div>
      <div class="info-row"><span class="info-label">Estado</span><span class="info-value" style="color: #4ade80;">✅ Confirmada</span></div>
    </div>

    <p>Te hemos enviado una invitación a tu calendario de Google. Por favor, revisá tu bandeja de entrada (o spam) para aceptarla.</p>
    
    ${calendarButton}
  `;
    return sendEmail({
        to: customerEmail,
        subject: "✅ Reunión Confirmada - OVNISTUDIO",
        html: getDarkEmailTemplate(content),
    });
}
export async function sendMeetingCancellationToUser(customerEmail, meetingData) {
    const formattedDate = formatDate(meetingData.date, meetingData.time);
    const content = `
    <h2>Reunión Cancelada</h2>
    <p>Hola <strong>${meetingData.customerName}</strong>,</p>
    <p>Lamentamos informarte que la reunión solicitada para el <strong>${formattedDate}</strong> no ha podido ser confirmada en esta ocasión.</p>
    <p>Por favor, contactanos nuevamente para buscar otro horario disponible.</p>
  `;
    return sendEmail({
        to: customerEmail,
        subject: "❌ Actualización sobre tu reunión",
        html: getDarkEmailTemplate(content),
    });
}
//# sourceMappingURL=emailService.js.map