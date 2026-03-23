import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import admin from "firebase-admin";
import { getAvailableSlots, formatAvailabilityMessage } from "../services/availabilityService.js";
import { createCalendarEvent, isCalendarConnected } from "../services/calendarService.js";
import { sendMeetingRequestToAdmin } from "../services/emailService.js";

/**
 * Herramienta para gestión de citas y disponibilidad.
 * Integra business hours, Google Calendar y emails.
 */
export const appointmentManagerTool = new DynamicStructuredTool({
  name: "appointment_manager",
  description: `HERRAMIENTA OBLIGATORIA para agendar reuniones. 
CUANDO USARLA: Siempre que el usuario mencione agendar, reunión, cita, turno, o quiera saber horarios disponibles.
DATOS NECESARIOS: nombre, email, fecha (YYYY-MM-DD), hora (HH:mm).
NO CONFIRMES una reunión sin usar esta herramienta.`,
  schema: z.object({
    action: z.enum(["check_availability", "check_next_days", "schedule"]).describe("check_availability=ver horarios de un día, check_next_days=ver disponibilidad próximos días, schedule=agendar reunión."),
    clientId: z.string().describe("ID del cliente/empresa."),
    date: z.string().describe("Fecha en formato YYYY-MM-DD. Ej: 2026-03-30"),
    daysAhead: z.number().optional().describe("Cantidad de días a buscar (default: 5)"),
    time: z.string().optional().describe("Hora en formato HH:mm. Ej: 10:00, 14:30"),
    userInfo: z.object({
      name: z.string().describe("Nombre completo de la persona"),
      email: z.string().email().describe("Email de contacto"),
      phone: z.string().optional().describe("Teléfono (opcional)"),
    }).optional().describe("Datos de la persona que reserva"),
    topic: z.string().optional().describe("Motivo o tema de la reunión"),
  }),
  func: async ({ action, clientId, date, daysAhead: daysAheadParam, time, userInfo, topic }) => {
    try {
      const db = admin.firestore();

      if (action === "check_availability") {
        if (!date) {
          return "ERROR: Necesito la fecha (YYYY-MM-DD) para ver disponibilidad.";
        }
        const message = await formatAvailabilityMessage(clientId, date);
        return message;
      }

      if (action === "check_next_days") {
        const daysAhead = daysAheadParam || 5;
        const now = new Date();
        const results: string[] = [];
        
        for (let i = 1; i <= daysAhead; i++) {
          const targetDate = new Date(now);
          targetDate.setDate(now.getDate() + i);
          const isoDate = targetDate.toISOString().split("T")[0];
          const { availableSlots, businessHours } = await getAvailableSlots(clientId, isoDate);
          
          if (businessHours.enabled && availableSlots.length > 0) {
            const formattedDate = targetDate.toLocaleDateString("es-AR", {
              weekday: "long",
              day: "numeric",
              month: "long",
              timeZone: "America/Argentina/Buenos_Aires",
            });
            results.push(`📅 ${formattedDate}: ${availableSlots.join(", ")}`);
          }
        }
        
        if (results.length === 0) {
          return "No hay horarios disponibles en los próximos días. Intentá con otra fecha.";
        }
        
        return `Horarios disponibles próximos ${daysAhead} días:\n\n${results.join("\n")}`;
      }

      if (action === "schedule") {
        if (!time || !userInfo?.name || !userInfo?.email) {
          return "ERROR: Para agendar necesito: fecha, hora, nombre y email del cliente.";
        }

        const { availableSlots } = await getAvailableSlots(clientId, date);
        
        if (!availableSlots.includes(time)) {
          return `El horario ${time} no está disponible para el ${date}. Horarios disponibles: ${availableSlots.join(", ") || "ninguno"}.`;
        }

        const meetingRef = await db.collection("meetings").add({
          clientId,
          date,
          time,
          customerName: userInfo.name,
          customerEmail: userInfo.email,
          customerPhone: userInfo.phone || "",
          topic: topic || "Consulta General",
          status: "pending",
          calendarEventId: null,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        try {
          const configDoc = await db.collection("config").doc(clientId).get();
          const adminEmail = configDoc.data()?.email;
          if (adminEmail) {
            await sendMeetingRequestToAdmin(adminEmail, {
              customerName: userInfo.name,
              customerEmail: userInfo.email,
              customerPhone: userInfo.phone,
              date,
              time,
              topic,
              meetingId: meetingRef.id,
            });
          }
        } catch (emailError) {
          console.warn("Email no enviado:", emailError);
        }

        const formattedDate = new Date(`${date}T${time}`).toLocaleString("es-AR", {
          weekday: "long",
          day: "numeric",
          month: "long",
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "America/Argentina/Buenos_Aires",
        });

        return `✅ Solicitud de reunión enviada!

📅 Fecha: ${formattedDate}
👤 Cliente: ${userInfo.name}
📧 Email: ${userInfo.email}
${topic ? `📝 Tema: ${topic}` : ""}

Tu solicitud está pendiente de confirmación. Te notificaremos cuando el administrador la apruebe.`;
      }

      return "Acción no reconocida. Usa 'check_availability' o 'schedule'.";
    } catch (error: any) {
      console.error("Error en appointment_manager:", error);
      return `Error al procesar la solicitud: ${error.message}`;
    }
  },
});
