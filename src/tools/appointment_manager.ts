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
  description: `SISTEMA DE GESTIÓN DE REUNIONES.

  USÁ ESTA HERRAMIENTA SOLO CUANDO HAYA INTENCIÓN CLARA DE AGENDA O DISPONIBILIDAD.

  CUÁNDO USARLA:
  1. Si el usuario pide explícitamente una reunión, cita, turno, llamada o demo.
  2. Si el usuario pregunta por horarios disponibles o disponibilidad.
  3. Si el usuario acepta ver horarios después de que se los ofrezcas en texto.

  CUÁNDO NO USARLA:
  1. No la uses solo porque el usuario preguntó por servicios, precios, catálogo o información general.
  2. No la uses para ofrecer reunión de forma automática después de cada respuesta comercial.
  3. No la uses si todavía estás en etapa de descubrimiento y el usuario no pidió agenda ni horarios.

  REGLAS DE USO:
  1. Si el usuario quiere una reunión pero no dijo fecha ni hora, ejecuta "check_next_days".
  2. Si el usuario ya eligió horario y dio Nombre/Email/Teléfono, PRIMERO debes mostrar un resumen con fecha, hora, nombre, email, teléfono y motivo, y pedir confirmación explícita o correcciones.
  3. Solo cuando el usuario confirme explícitamente que esos datos son correctos, ejecuta "schedule" con confirmedByUser=true.
  4. La acción "schedule" ES LA ÚNICA forma de registrar la cita. Si no ejecutas "schedule", la cita no existe.`,
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
    confirmedByUser: z.boolean().optional().describe("Solo true si el usuario ya confirmó explícitamente que los datos de la reunión son correctos."),
  }),
  func: async (args) => {
    try {
      // Validación de argumentos mínimos
      if (!args || typeof args !== 'object') {
        return '⛔ ERROR: Argumentos inválidos para appointment_manager.';
      }
      const { action = "check_next_days", clientId, threadId, date, time, userInfo, topic, confirmedByUser } = args;
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
        if (!confirmedByUser) {
          const friendlyDate = formatFriendlyDate(cleanDate);
          const confirmationTopic = finalTopic || "Consulta General";
          return [
            "⚠️ ANTES DE CREAR LA SOLICITUD debes pedir confirmación explícita al usuario.",
            "Compartile este resumen y preguntale si está correcto o si quiere corregir algo:",
            `- Fecha: ${friendlyDate}`,
            `- Hora: ${time}`,
            `- Nombre: ${finalUserInfo.name}`,
            `- Email: ${finalUserInfo.email}`,
            `- Teléfono: ${finalUserInfo.phone || "No proporcionado"}`,
            `- Motivo: ${confirmationTopic}`,
            "Si el usuario confirma que todo está correcto, vuelve a ejecutar appointment_manager con action=\"schedule\" y confirmedByUser=true.",
          ].join("\n");
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