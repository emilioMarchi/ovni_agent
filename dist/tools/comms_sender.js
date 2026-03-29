import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { Resend } from "resend";
const resend = new Resend(process.env.RESEND_API_KEY);
/**
 * Herramienta para envío de comunicaciones (Email) vía Resend.
 */
export const commsSenderTool = new DynamicStructuredTool({
    name: "comms_sender",
    description: "Envía correos electrónicos a usuarios o administradores (ej: propuestas, resúmenes, notificaciones).",
    schema: z.object({
        to: z.string().email().describe("Dirección de correo del destinatario."),
        subject: z.string().describe("Asunto del correo."),
        body: z.string().describe("Contenido del mensaje (puede ser texto plano o HTML simple)."),
        fromName: z.string().optional().default("Agente OVNI").describe("Nombre que aparecerá como remitente."),
    }),
    func: async ({ to, subject, body, fromName }) => {
        try {
            const from = `${fromName} <onboarding@resend.dev>`; // En producción usar dominio verificado
            const { data, error } = await resend.emails.send({
                from,
                to: [to],
                subject,
                html: `
          <div style="font-family: sans-serif; padding: 20px; color: #333;">
            <h2 style="color: #6366f1;">${subject}</h2>
            <div style="line-height: 1.6; font-size: 16px;">
              ${body.replace(/\n/g, "<br>")}
            </div>
            <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="font-size: 12px; color: #999;">
              Este es un mensaje automático enviado por tu asistente inteligente.
            </p>
          </div>
        `,
            });
            if (error) {
                console.error("Error de Resend:", error);
                return `No se pudo enviar el correo: ${error.message}`;
            }
            return `Correo enviado exitosamente a ${to}. ID: ${data?.id}`;
        }
        catch (error) {
            console.error("Error en comms_sender:", error);
            return `Error al enviar la comunicación: ${error.message}`;
        }
    },
});
//# sourceMappingURL=comms_sender.js.map