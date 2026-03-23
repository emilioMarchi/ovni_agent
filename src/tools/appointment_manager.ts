import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import admin from "firebase-admin";

/**
 * Herramienta para la gestión de citas y disponibilidad.
 * Registra solicitudes en Firestore para posterior procesamiento con Google Calendar.
 */
export const appointmentManagerTool = new DynamicStructuredTool({
  name: "appointment_manager",
  description: "Gestiona la disponibilidad y agenda citas para los usuarios.",
  schema: z.object({
    action: z.enum(["check_availability", "schedule"]).describe("Acción a realizar."),
    clientId: z.string().describe("ID del cliente (empresa)."),
    date: z.string().describe("Fecha en formato YYYY-MM-DD."),
    time: z.string().optional().describe("Hora en formato HH:mm."),
    userInfo: z.object({
      name: z.string(),
      email: z.string().email(),
      phone: z.string(),
    }).optional().describe("Información del usuario para agendar."),
    topic: z.string().optional().describe("Tema de la reunión."),
  }),
  func: async ({ action, clientId, date, time, userInfo, topic }) => {
    try {
      const db = admin.firestore();

      if (action === "check_availability") {
        // Lógica simplificada: Consultar si ya hay citas en ese horario
        const snapshot = await db.collection("meetings")
          .where("clientId", "==", clientId)
          .where("date", "==", date)
          .get();
        
        const bookedTimes = snapshot.docs.map(doc => doc.data().time);
        const availableTimes = ["09:00", "10:00", "11:00", "14:00", "15:00", "16:00"]
          .filter(t => !bookedTimes.includes(t));

        if (availableTimes.length === 0) {
          return `No hay horarios disponibles para el día ${date}.`;
        }
        return `Horarios disponibles para ${date}: ${availableTimes.join(", ")}.`;
      }

      if (action === "schedule") {
        if (!time || !userInfo) {
          return "Se requiere hora e información del usuario para agendar la cita.";
        }

        const meetingRef = await db.collection("meetings").add({
          clientId,
          date,
          time,
          customerName: userInfo.name,
          customerEmail: userInfo.email,
          customerPhone: userInfo.phone,
          topic: topic || "Consulta General",
          status: "pending",
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        return `Cita agendada exitosamente (pendiente de confirmación). ID: ${meetingRef.id}`;
      }

      return "Acción no reconocida.";
    } catch (error: any) {
      console.error("Error en appointment_manager:", error);
      return `Error al gestionar la cita: ${error.message}`;
    }
  },
});
