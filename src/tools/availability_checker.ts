import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { getAvailableSlots, formatAvailabilityMessage } from "../services/availabilityService.js";
import { addDaysToDateString, formatFriendlyDate, formatGroupedSlots, getTodayDateString } from "../utils/dateUtils.js";

export const availabilityCheckerTool = new DynamicStructuredTool({
  name: "availability_checker",
  description: `Úsala cuando el usuario pregunte explícitamente qué horarios están disponibles para agendar o cuando ya aceptó ver disponibilidad.
No la uses para ofrecer horarios de forma automática si el usuario todavía no pidió agenda ni disponibilidad.
- "check_next_days": Devuelve los próximos días con horarios disponibles (para cuando el usuario no tiene fecha específica)
- "check_specific_day": Devuelve los horarios de un día específico (cuando el usuario ya dijo qué día)`,
  schema: z.object({
    action: z.enum(["check_next_days", "check_specific_day"]).describe("Tipo de consulta"),
    clientId: z.string().describe("ID del cliente/empresa"),
    daysAhead: z.number().optional().describe("Días a buscar hacia adelante (default: 5)"),
    date: z.string().optional().describe("Fecha específica en formato YYYY-MM-DD"),
  }),
  func: async ({ action, clientId, daysAhead = 5, date }) => {
    try {
      if (action === "check_next_days") {
        const today = getTodayDateString();
        const results: string[] = [];
        
        for (let i = 1; i <= daysAhead; i++) {
          const isoDate = addDaysToDateString(today, i);
          const { availableSlots, businessHours } = await getAvailableSlots(clientId, isoDate);
          
          if (businessHours.enabled && availableSlots.length > 0) {
            const formattedDate = formatFriendlyDate(isoDate);
            results.push(`📅 ${formattedDate}: ${formatGroupedSlots(availableSlots)}`);
          }
        }
        
        if (results.length === 0) {
          return "No hay horarios disponibles en los próximos días. ¿Podrías darme una fecha específica para buscar?";
        }
        
        return `Horarios disponibles:\n\n${results.join("\n")}`;
      }

      if (action === "check_specific_day") {
        if (!date) {
          return "ERROR: Necesito una fecha específica (YYYY-MM-DD) para buscar disponibilidad.";
        }
        return await formatAvailabilityMessage(clientId, date);
      }

      return "Acción no reconocida. Usa 'check_next_days' o 'check_specific_day'.";
    } catch (error: any) {
      console.error("Error en availability_checker:", error);
      return `Error al consultar disponibilidad: ${error.message}`;
    }
  },
});
