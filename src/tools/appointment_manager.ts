import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import admin from "firebase-admin";
import { getAvailableSlots } from "../services/availabilityService.js";
import { sendMeetingRequestToAdmin, sendRequestReceivedToUser } from "../services/emailService.js";
import { getSessionData } from "./context_manager.js";

/**
 * Herramienta para gestión de citas y disponibilidad.
 */
export const appointmentManagerTool = new DynamicStructuredTool({
  name: "appointment_manager",
  description: `SISTEMA DE GESTIÓN DE REUNIONES - FLUJO OBLIGATORIO.

  1. ANTES DE HABLAR: Si el usuario quiere una reunión, ejecuta SIEMPRE "check_next_days" para ver disponibilidad. No respondas con texto antes de saber qué hay disponible.
  2. AL CONFIRMAR: Si el usuario ya eligió horario y dio Nombre/Email/Teléfono, ejecuta "schedule" obligatoriamente.
  3. FINALIZAR: La acción "schedule" ES LA ÚNICA forma de registrar la cita. Si no ejecutas "schedule", la cita no existe.`,
  schema: z.object({
    action: z.enum(["check_availability", "check_next_days", "schedule"]).default("check_next_days"),
    clientId: z.string(),
    threadId: z.string().optional().describe("ID de la sesión actual (necesario para recuperar datos guardados del usuario)."),
    date: z.string().optional(),
    time: z.string().optional(),
    userInfo: z.object({
      name: z.string().optional(),
      email: z.string().email().optional(),
      phone: z.string().optional(),
    }).optional(),
    topic: z.string().optional(),
  }),
  func: async ({ action = "check_next_days", clientId, threadId, date, time, userInfo, topic }) => {
    try {
      const db = admin.firestore();
      
      // Intentar recuperar contexto si hay threadId
      let finalUserInfo = userInfo || {};
      let finalTopic = topic;

      if (threadId) {
        const ctx = getSessionData(threadId);
        finalUserInfo = {
          name: finalUserInfo.name || ctx.userInfo?.name,
          email: finalUserInfo.email || ctx.userInfo?.email,
          phone: finalUserInfo.phone || ctx.userInfo?.phone,
        };
        // Si no hay topic explícito, ver si hay info de negocio relevante
        if (!finalTopic && ctx.businessInfo?.rubric) {
           finalTopic = `Consulta sobre ${ctx.businessInfo.rubric} (${ctx.businessInfo.proyecto || "General"})`;
        }
      }

      // Si el modelo envió un objeto vacío o acción nula/undefined, forzamos la acción principal
      const effectiveAction = action || "check_next_days";
      console.log(`🔍 [APPOINTMENT] Ejecutando acción: ${effectiveAction}`);

      if (effectiveAction === "schedule") {
        if (!date || !time) {
             return "⛔ ERROR: Faltan fecha y hora para agendar.";
        }
        if (!finalUserInfo?.name || !finalUserInfo?.email) {
          return "⛔ ERROR CRÍTICO: Para agendar necesito nombre y email. Si ya los diste, por favor repítelos o asegúrate de que se hayan guardado.";
        }
        
        const { availableSlots } = await getAvailableSlots(clientId, date);
        if (!availableSlots.includes(time)) return `⛔ ${time} ya está ocupado.`;

        const meetingRef = await db.collection("meetings").add({
          clientId, date, time, 
          customerName: finalUserInfo.name, 
          customerEmail: finalUserInfo.email,
          customerPhone: finalUserInfo.phone || "No proporcionado",
          topic: finalTopic || "Consulta General",
          status: "pending", createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        // 1. Notificar al Admin
        try {
            const adminDoc = await db.collection("admins").doc(clientId).get();
            const adminEmail = adminDoc.data()?.email;
            console.log(`🔍 [DEBUG] Intentando enviar email a: ${adminEmail} para reunión: ${meetingRef.id}`);
            if (adminEmail) {
                await sendMeetingRequestToAdmin(adminEmail, { 
                    customerName: finalUserInfo.name!,
                    customerEmail: finalUserInfo.email!,
                    customerPhone: finalUserInfo.phone,
                    date, 
                    time, 
                    topic: finalTopic, 
                    meetingId: meetingRef.id 
                });
                console.log("✅ Email de solicitud enviado al admin.");
            } else {
                console.warn(`⚠️ No se encontró email del admin en colección 'admins' para clientId: ${clientId}`);
            }
        } catch(e) {
            console.error("❌ Error enviando email de solicitud al Admin:", e);
        }

        // 2. Notificar al Usuario (Nuevo paso)
        try {
            await sendRequestReceivedToUser(finalUserInfo.email!, {
                customerName: finalUserInfo.name!,
                date,
                time,
                topic: finalTopic
            });
            console.log("✅ Email de confirmación de recepción enviado al usuario.");
        } catch(e) {
            console.error("❌ Error enviando email de recepción al usuario:", e);
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