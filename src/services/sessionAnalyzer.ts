import { ChatGoogleGenerativeAI } from "@langchain/google-genai";

const model = new ChatGoogleGenerativeAI({
  modelName: "gemini-2.0-flash",
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

export async function analyzeSession(messages: any[]): Promise<SessionAnalysis> {
  const userMessages = messages
    .filter(m => m.role === "user")
    .map(m => m.content)
    .join("\n");

  const assistantMessages = messages
    .filter(m => m.role === "assistant")
    .map(m => m.content)
    .join("\n");

  const prompt = `Analiza esta conversación entre un usuario y un asistente virtual. 
Devuelve SOLO un JSON válido (sin markdown, sin texto adicional) con esta estructura:

{
  "summary": "Resumen de 2-3 oraciones sobre qué trata la conversación",
  "classification": {
    "type": "lead" | "conversation" | "support",
    "interestLevel": "high" | "medium" | "low",
    "intentions": ["intención 1", "intención 2"],
    "topics": ["tema 1", "tema 2"],
    "sentiment": "positive" | "neutral" | "negative"
  }
}

指南:
- "type": "lead" si el usuario показал interés en comprar/contactar, "support" si busca ayuda técnica, "conversation" otherwise
- "interestLevel": "high" si запросó presupuesto o reunión, "medium" si hizo preguntas sobre productos, "low" si solo consultó información general
- "intentions": las intenciones principales del usuario (ej: "comprar producto", "consultar precio", "soporte técnico")
- "topics": temas detectados (ej: "productos", "precios", "servicios", " técnico")
- "sentiment": sentimiento general de la conversación

Mensajes del usuario:
${userMessages.slice(0, 2000)}

Respuestas del asistente:
${assistantMessages.slice(0, 2000)}`;

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
