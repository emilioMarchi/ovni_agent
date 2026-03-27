import { ChatGoogleGenerativeAI } from "@langchain/google-genai";

const model = new ChatGoogleGenerativeAI({
  modelName: "gemini-2.5-flash",
  temperature: 0.2,
  apiKey: process.env.GEMINI_API_KEY,
});

export interface SessionClassification {
  type: "lead" | "conversation" | "support";
  interestLevel: "high" | "medium" | "low";
  intentions: string[];
  topics: string[];
  sentiment: "positive" | "neutral" | "negative";
}

export interface SessionAnalysis {
  summary: string;
  classification: SessionClassification;
}

export async function analyzeSession(messages: any[], userName?: string | null): Promise<SessionAnalysis> {
  const userMessages = messages
    .filter(m => m.role === "user")
    .map(m => typeof m.content === 'string' ? m.content : JSON.stringify(m.content))
    .join("\n");

  const prompt = `Analiza SOLO los mensajes del usuario en esta conversación. 
El usuario${userName ? ` se llama ${userName}` : ''}.
Devuelve SOLO un JSON válido (sin markdown, sin texto adicional) con esta estructura:

{
  "summary": "Resumen de 1-2 oraciones sobre qué necesitaba o consultó el usuario (no lo que respondió el asistente)",
  "classification": {
    "type": "lead" | "conversation" | "support",
    "interestLevel": "high" | "medium" | "low",
    "intentions": ["intención principal del usuario"],
    "topics": ["temas que consultó el usuario"],
    "sentiment": "positive" | "neutral" | "negative"
  }
}

Guía:
- "summary": Qué quería el usuario, no qué se le respondió. Ej: "Usuario consultó por servicios de desarrollo web"
- "type": "lead" si pidió presupuesto/contacto, "support" si necesitaba ayuda, "conversation" para consultas generales
- "interestLevel": "high" si pidió reunión/presupuesto, "medium" si preguntó detalles de productos, "low" si solo saludó o consultó info general

Mensajes del usuario:
${userMessages.slice(0, 1500)}`;

  try {
    const result = await model.invoke(prompt);
    const text = result.content as string;
    const cleaned = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    
    return {
      summary: parsed.summary || "Sin resumen disponible",
      classification: {
        type: parsed.classification?.type || "conversation",
        interestLevel: parsed.classification?.interestLevel || "low",
        intentions: parsed.classification?.intentions || [],
        topics: parsed.classification?.topics || [],
        sentiment: parsed.classification?.sentiment || "neutral",
      }
    };
  } catch (error) {
    console.error("Error analyzing session:", error);
    return {
      summary: "Error al generar resumen",
      classification: {
        type: "conversation",
        interestLevel: "low",
        intentions: [],
        topics: [],
        sentiment: "neutral",
      }
    };
  }
}
