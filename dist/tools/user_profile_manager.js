import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import admin from "firebase-admin";
/**
 * Herramienta para gestionar perfiles de usuario y estados de flujo en Firestore.
 * Permite persistir información de contacto y el progreso de la conversación.
 */
export const userProfileManagerTool = new DynamicStructuredTool({
    name: "user_profile_manager",
    description: "Consulta o actualiza el perfil del usuario, incluyendo datos de contacto y el estado actual del flujo de conversación.",
    schema: z.object({
        action: z.enum(["get", "update", "create"]).describe("Acción a realizar sobre el perfil."),
        userId: z.string().describe("Identificador único del usuario (ej: número de teléfono o ID de sesión)."),
        clientId: z.string().describe("ID del cliente al que pertenece el usuario."),
        data: z.object({
            name: z.string().optional(),
            email: z.string().email().optional(),
            phone: z.string().optional(),
            flowState: z.string().optional(),
            metadata: z.record(z.any()).optional(),
        }).optional().describe("Datos para actualizar o crear el perfil."),
    }),
    func: async ({ action, userId, clientId, data }) => {
        try {
            const db = admin.firestore();
            const userRef = db.collection("users").doc(`${clientId}_${userId}`);
            if (action === "get") {
                const doc = await userRef.get();
                if (!doc.exists) {
                    return `No se encontró un perfil para el usuario ${userId}.`;
                }
                return JSON.stringify(doc.data(), null, 2);
            }
            if (action === "create" || action === "update") {
                if (!data)
                    return "Se requieren datos para realizar esta acción.";
                const payload = {
                    ...data,
                    clientId,
                    userId,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                };
                if (action === "create") {
                    payload.createdAt = admin.firestore.FieldValue.serverTimestamp();
                    await userRef.set(payload);
                    return `Perfil creado exitosamente para el usuario ${userId}.`;
                }
                else {
                    await userRef.update(payload);
                    return `Perfil actualizado exitosamente para el usuario ${userId}.`;
                }
            }
            return "Acción no reconocida.";
        }
        catch (error) {
            console.error("Error en user_profile_manager:", error);
            return `Error al gestionar el perfil de usuario: ${error.message}`;
        }
    },
});
//# sourceMappingURL=user_profile_manager.js.map