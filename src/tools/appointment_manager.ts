import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import admin from "firebase-admin";
import { getAvailableSlots } from "../services/availabilityService.js";
import { sendMeetingRequestToAdmin, sendRequestReceivedToUser } from "../services/emailService.js";
import { getSessionData } from "./context_manager.js";
import { getTodayDateString, formatFriendlyDate } from "../utils/dateUtils.js";
import { toDate, formatInTimeZone } from 'date-fns-tz';

const TIMEZONE = 'America/Argentina/Buenos_Aires';

/**
 * Herramienta para gestión de citas y disponibilidad.
 */
export const appointmentManagerTool = new DynamicStructuredTool({
  name: "appointment_manager",
  description: `SISTEMA DE GESTIÓN DE REUNIONES - FLUJO OBLIGATORIO.

  1. OFRECER REUNIÓN: Después de dar información de servicios/precios/catálogo, DEBES ejecutar check_next_days automáticamente para mostrar disponibilidad y ofrecer reunión. NO solo preguntes "¿quieres agendar?" - USÁ LA HERRAMIENTA.

  2. ANTES DE HABLAR: Si el usuario quiere una reunión, ejecuta SIEMPRE "check_next_days" para ver disponibilidad. No respondas con texto antes de saber qué hay disponible.

  3. AL CONFIRMAR: Si el usuario ya eligió horario y dio Nombre/Email/Teléfono, ejecuta "schedule" obligatoriamente.

  4. FINALIZAR: La acción "schedule" ES LA ÚNICA forma de registrar la cita. Si no ejecutas "schedule", la cita no existe.`,
  schema: z.object({
    action: z.enum(["check_availability", "check_next_days", "schedule"]).default("check_next_days"),
    clientId: z.string(),
    threadId: z.string().optional().describe("ID de la sesión actual (necesario para recuperar datos guardados del usuario)."),
    date: z.string().optional().describe("Fecha en formato YYYY-MM-DD"),
    time: z.string().optional().describe("Hora en formato HH:MM (24h)"),
    userInfo: z.object({
      name: z.string().optional(),
      email: z.string().email().optional(),
      phone: z.string().optional(),
    }).optional(),
    topic: z.string().optional(),
  }),
  func: async (args) => {
    try {
      // Validación de argumentos mínimos
      if (!args || typeof args !== 'object') {
        return '⛔ ERROR: Argumentos inválidos para appointment_manager.';
      }
      const { action = "check_next_days", clientId, threadId, date, time, userInfo, topic } = args;
      if (!clientId || typeof clientId !== 'string' || clientId.trim() === '') {
        return '⛔ ERROR: clientId es requerido para appointment_manager.';
      }
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
        if (!finalTopic && ctx.businessInfo?.rubric) {
           finalTopic = `Consulta sobre ${ctx.businessInfo.rubric} (${ctx.businessInfo.proyecto || "General"})`;
        }
      }
      const effectiveAction = action || "check_next_days";
      console.log(`🔍 [APPOINTMENT] Ejecutando acción: ${effectiveAction}`);
      if (effectiveAction === "schedule") {
        if (!date || !time) {
             return "⛔ ERROR: Faltan fecha y hora para agendar.";
        }
        const cleanDate = date.split('T')[0];
        if (!finalUserInfo?.name || !finalUserInfo?.email) {
          return "⛔ ERROR CRÍTICO: Para agendar necesito nombre y email. Si ya los diste, por favor repítelos o asegúrate de que se hayan guardado.";
        }
        const { availableSlots } = await getAvailableSlots(clientId, cleanDate);
        if (!availableSlots.includes(time)) return `⛔ El horario ${time} ya no está disponible para el ${formatFriendlyDate(cleanDate)}. Por favor elige otro.`;
        const meetingRef = await db.collection("meetings").add({
          clientId, date: cleanDate, time, 
          customerName: finalUserInfo.name, 
          customerEmail: finalUserInfo.email,
          customerPhone: finalUserInfo.phone || "No proporcionado",
          topic: finalTopic || "Consulta General",
          status: "pending", createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
        try {
            const adminDoc = await db.collection("admins").doc(clientId).get();
            const adminEmail = adminDoc.data()?.email;
            if (adminEmail) {
                await sendMeetingRequestToAdmin(adminEmail, { 
                    customerName: finalUserInfo.name!,
                    customerEmail: finalUserInfo.email!,
                    customerPhone: finalUserInfo.phone,
                    date: cleanDate, 
                    time, 
                    topic: finalTopic, 
                    meetingId: meetingRef.id 
                });
            }
        } catch(e) {
            console.error("❌ Error enviando email de solicitud al Admin:", e);
        }
        try {
            await sendRequestReceivedToUser(finalUserInfo.email!, {
                customerName: finalUserInfo.name!,
                date: cleanDate,
                time,
                topic: finalTopic
            });
        } catch(e) {
            console.error("❌ Error enviando email de recepción al usuario:", e);
        }
        const friendlyDate = formatFriendlyDate(cleanDate);
        return `✅ SOLICITUD CREADA CON ÉXITO para el ${friendlyDate} a las ${time}hs. ID: ${meetingRef.id}. Avísale al usuario que está pendiente de confirmación por parte del administrador.`;
      }
      if (effectiveAction === "check_next_days") {
        const daysAhead = 7;
        const todayStr = getTodayDateString();
        const results: string[] = [];
        for (let i = 1; i <= daysAhead; i++) {
          const dateObj = toDate(`${todayStr}T12:00:00`, { timeZone: TIMEZONE });
          dateObj.setDate(dateObj.getDate() + i);
          const isoDate = formatInTimeZone(dateObj, TIMEZONE, 'yyyy-MM-dd');
          const { availableSlots, businessHours } = await getAvailableSlots(clientId, isoDate);
          if (businessHours.enabled && availableSlots.length > 0) {
            const formattedDate = formatFriendlyDate(isoDate);
            results.push(`📅 ${formattedDate}: ${availableSlots.join(", ")}`);
          }
        }
        return results.length > 0 ? `Horarios disponibles:\n\n${results.join("\n")}` : "Lo siento, no tengo disponibilidad en los próximos días hábiles.";
      }
      return "Acción no reconocida.";
    } catch (error: any) {
      console.error("Error en appointment_manager:", error);
      return `Error técnico: ${error.message}`;
    }
  },
});