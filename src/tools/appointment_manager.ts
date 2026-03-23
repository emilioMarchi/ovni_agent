import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import admin from "firebase-admin";
import { getAvailableSlots } from "../services/availabilityService.js";
import { sendMeetingRequestToAdmin } from "../services/emailService.js";

/**
 * Herramienta para gestión de citas y disponibilidad.
 */
export const appointmentManagerTool = new DynamicStructuredTool({
  name: "appointment_manager",
  description: `SISTEMA DE GESTIÓN DE REUNIONES - FLUJO OBLIGATORIO.

  1. ANTES DE HABLAR: Si el usuario quiere una reunión, ejecuta SIEMPRE "check_next_days" para ver disponibilidad. No respondas con texto antes de saber qué hay disponible.
  2. AL CONFIRMAR: Si el usuario ya eligió horario y dio Nombre/Email, ejecuta "schedule" obligatoriamente.
  3. FINALIZAR: La acción "schedule" ES LA ÚNICA forma de registrar la cita. Si no ejecutas "schedule", la cita no existe.`,
  schema: z.object({
    action: z.enum(["check_availability", "check_next_days", "schedule"]).default("check_next_days"),
    clientId: z.string(),
    date: z.string().optional(),
    time: z.string().optional(),
    userInfo: z.object({
      name: z.string(),
      email: z.string().email(),
      phone: z.string().optional(),
    }).optional(),
    topic: z.string().optional(),
  }),
  func: async ({ action = "check_next_days", clientId, date, time, userInfo, topic }) => {
    try {
      const db = admin.firestore();
      
      // Si el modelo envió un objeto vacío o acción nula/undefined, forzamos la acción principal
      const effectiveAction = action || "check_next_days";
      console.log(`🔍 [APPOINTMENT] Ejecutando acción: ${effectiveAction}`);

      if (effectiveAction === "schedule") {
        if (!date || !time || !userInfo?.name || !userInfo?.email) {
          return "⛔ ERROR CRÍTICO: Para agendar necesito nombre, email, fecha y hora.";
        }
        
        const { availableSlots } = await getAvailableSlots(clientId, date);
        if (!availableSlots.includes(time)) return `⛔ ${time} ya está ocupado.`;

        const meetingRef = await db.collection("meetings").add({
          clientId, date, time, 
          customerName: userInfo.name, customerEmail: userInfo.email,
          status: "pending", createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        try {
            const adminDoc = await db.collection("admins").doc(clientId).get();
            const adminEmail = adminDoc.data()?.email;
            console.log(`🔍 [DEBUG] Intentando enviar email a: ${adminEmail} para reunión: ${meetingRef.id}`);
            if (adminEmail) {
                await sendMeetingRequestToAdmin(adminEmail, { ...userInfo, date, time, topic, meetingId: meetingRef.id } as any);
                console.log("✅ Email de solicitud enviado al admin.");
            } else {
                console.warn(`⚠️ No se encontró email del admin en colección 'admins' para clientId: ${clientId}`);
            }
        } catch(e) {
            console.error("❌ Error enviando email de solicitud:", e);
        }
        
        return `✅ SOLICITUD CREADA CON ÉXITO. ID: ${meetingRef.id}. Avísale al cliente que está pendiente de confirmación.`;
      }

      if (action === "check_next_days") {
        const daysAhead = 5;
        const now = new Date();
        const results: string[] = [];
        for (let i = 1; i <= daysAhead; i++) {
          const targetDate = new Date(now);
          targetDate.setDate(now.getDate() + i);
          const isoDate = targetDate.toISOString().split("T")[0];
          const { availableSlots, businessHours } = await getAvailableSlots(clientId, isoDate);
          if (businessHours.enabled && availableSlots.length > 0) {
            results.push(`📅 ${isoDate}: ${availableSlots.join(", ")}`);
          }
        }
        return results.length > 0 ? results.join("\n") : "Sin disponibilidad.";
      }

      return "Acción no reconocida.";
    } catch (error: any) {
      console.error("Error en appointment_manager:", error);
      return `Error técnico: ${error.message}`;
    }
  },
});