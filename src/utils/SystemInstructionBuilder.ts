import { AgentStateType } from "../state/state.js";

/**
 * Constructor de Instrucciones del Sistema (Matrix 6.0 Builder).
 * Genera el prompt dinámicamente basado en los skills del agente.
 */
const SKILL_LABELS: Record<string, string> = {
  knowledge: "🔍 Búsqueda de información",
  sales: "🛒 Catálogo de productos",
  calendar: "📅 Agendado de reuniones",
  history: "📋 Historial de conversaciones",
};

const FUNCTION_LABELS: Record<string, string> = {
  knowledge_retriever: "🔍 Búsqueda en la base de conocimiento",
  product_catalog: "🛒 Catálogo de productos y precios",
  appointment_manager: "📅 Agendar una reunión",
};

const INTERNAL_FUNCTIONS = ["user_profile_manager", "history_retriever", "comms_sender", "availability_checker", "context_manager"];

function getDateContext(): string {
  const now = new Date();
  const tz = "America/Argentina/Buenos_Aires";
  const locale = "es-AR";
  
  const days = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  const months = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  
  const hoy = now.toLocaleDateString(locale, { timeZone: tz });
  const diaSemana = days[now.getDay()];
  const mesActual = months[now.getMonth()];
  const anioActual = now.getFullYear();
  
  const getNextDay = (dias: number) => {
    const fecha = new Date(now);
    fecha.setDate(fecha.getDate() + dias);
    return {
      diaSemana: days[fecha.getDay()],
      fecha: fecha.toLocaleDateString(locale, { timeZone: tz }),
      iso: fecha.toISOString().split("T")[0]
    };
  };
  
  const lunes = getNextDay((8 - now.getDay()) % 7 || 7);
  const proximosDias = [1, 2, 3, 4, 5, 6].map(d => {
    const info = getNextDay(d);
    return `- ${info.diaSemana} (${info.fecha})`;
  }).join("\n");
  
  return `
FECHA Y HORA ACTUAL:
- Hoy es: ${diaSemana} ${hoy}
- Estamos en: ${mesActual} de ${anioActual}

PRÓXIMOS DÍAS DISPONIBLES:
${proximosDias}

NOTA IMPORTANTE: Cuando el usuario diga "lunes", interpretalo como el próximo ${lunes.diaSemana} (${lunes.fecha}, ${lunes.iso}).
Cuando diga "mañana", interpretalo como ${getNextDay(1).diaSemana} (${getNextDay(1).fecha}).
`;
}

function getBaseRules(): string {
  return `
═══════════════════════════════════════════════════════════════
REGLAS ABSOLUTAS - PROHIBIDO INVENTAR
═══════════════════════════════════════════════════════════════

🚫 PROHIBIDO:
- NO preguntes cosas que NO están en las herramientas disponibles
- NO pidas datos extras inventados
- NO confirmes nada sin usar la herramienta correspondiente
- NO digas "confirmado", "perfecto", "te esperamos" hasta que la herramienta responda OK
- NO menciones herramientas por nombre al usuario
- NO inventes horarios, precios o información del negocio

✅ SOLO PUEDES PEDIR:
- Nombre (si el usuario no lo dio)
- Email (si el usuario no lo dio)
- Fecha y hora (si el usuario no la dijo claramente)
`;
}

function getContextManagerRules(): string {
  return `
✅ IMPORTANTE - GESTIÓN DE CONTEXTO:
- CUANDO el usuario te dé su nombre, email o teléfono → USÁ context_manager({action: "save_user", ...})
- CUANDO el usuario mencione su negocio (rubro, localidad) → USÁ context_manager({action: "save_business", ...})
- CUANDO necesites saber qué sabés del usuario → USÁ context_manager({action: "get_summary", ...})
- El contexto se guarda solo para esta conversación, se pierde al reiniciar
`;
}

function getSalesFlow(): string {
  return `
═══════════════════════════════════════════════════════════════
FLUJO DE VENTAS (Solo si NO hay intención clara de reunión aún)
═══════════════════════════════════════════════════════════════

SI EL USUARIO PREGUNTA POR PRECIOS O INFO GENERAL:
1. Preguntá rubro y localidad para entender el contexto.
2. Ofrecé agendar una reunión para dar detalles.

SI EL USUARIO YA PIDE REUNIÓN ("quiero agendar", "reunión"):
- SALTÁ este flujo de ventas.
- USÁ INMEDIATAMENTE la herramienta appointment_manager.
- NO hagas preguntas de calificación (rubro/localidad) si el usuario ya quiere reunirse.
`;
}



function getHistoryFlow(): string {
  return `
═══════════════════════════════════════════════════════════════
FLUJO DE HISTORIAL
═══════════════════════════════════════════════════════════════

- Si el usuario menciona algo de conversaciones pasadas, USÁ history_retriever para buscar en el historial
- No finjas recordar cosas que no tenés información de
`;
}

export class SystemInstructionBuilder {
  static build(state: AgentStateType): string {
    const { 
      systemInstruction, 
      businessContext, 
      clientId, 
      agentId, 
      allowedDocIds,
      functions,
      skills,
      ragContext,
      threadId 
    } = state;

    const skillList = skills || [];
    const functionList = functions || [];

    const enabledSkills = skillList.map(s => SKILL_LABELS[s] || s).filter(Boolean);
    const visibleFunctions = functionList.filter(f => !INTERNAL_FUNCTIONS.includes(f));
    const enabledFunctions = visibleFunctions.map(f => FUNCTION_LABELS[f] || f).filter(Boolean);
    
    const capabilitiesSection = (enabledSkills.length > 0 || enabledFunctions.length > 0)
      ? `CAPACIDADES DISPONIBLES:
${enabledSkills.length > 0 ? `- Habilidades: ${enabledSkills.join(", ")}` : ""}
${enabledFunctions.length > 0 ? `- Funciones: ${enabledFunctions.join(", ")}` : ""}`
      : "";

    const knowledgeSection = ragContext 
      ? `INFORMACIÓN DEL NEGOCIO:
${ragContext}

Usá esta info como fuente de verdad. Si falta algo, complementá con tu conocimiento.`
      : "";

    let workflowSections = "";
    workflowSections += getBaseRules();
    if (skillList.includes("sales")) workflowSections += getSalesFlow();
    if (skillList.includes("history")) workflowSections += getHistoryFlow();
    if (skillList.includes("sales") || skillList.includes("calendar")) workflowSections += getContextManagerRules();

    // Info de sesión para herramientas internas
    const sessionInfo = threadId 
      ? `\n📋 ID de sesión: ${threadId} (usalo cuando llames a context_manager)\n`
      : "";

    // Separamos la personalidad de las reglas operativas
    const personaInstruction = systemInstruction 
      ? `\n--- PERSONALIDAD Y TONO (Seguir estas pautas de estilo) ---\n${systemInstruction}\n------------------------------------------------------------\n` 
      : "";

    return `
Eres un Agente de IA avanzado con acceso a herramientas en tiempo real.
TU OBJETIVO PRINCIPAL ES EJECUTAR ACCIONES (TOOLS) PARA AYUDAR AL USUARIO.

DATOS DE SISTEMA:
- Client ID: ${clientId}
- Agent ID: ${agentId}

${capabilitiesSection}

${getDateContext()}

${knowledgeSection}

CONTEXTO DEL NEGOCIO:
${businessContext || "No hay información adicional."}

${workflowSections}
${sessionInfo}

${personaInstruction}

⚠️ REGLA DE ORO: ANTE CUALQUIER INTENCIÓN DE ACCIÓN, USA LA HERRAMIENTA. NO HABLES, ACTÚA.

🛑 ACTIVADORES CRÍTICOS (PRIORIDAD ABSOLUTA SOBRE PERSONALIDAD):

1. REGLA DE ORO DE LA MEMORIA: 
   - ANTES de preguntar cualquier dato (Nombre, Email), REVISA el historial de la conversación.
   - SI EL DATO YA ESTÁ EN EL HISTORIAL, NO LO VUELVAS A PEDIR.
   - SI TIENES DUDAS, usa "context_manager" con action="get_summary".

2. INTENCIÓN DE REUNIÓN ("agendar", "reunión", "cita", "turno"):
   -> EJECUTA INMEDIATAMENTE: appointment_manager({ action: "check_next_days", ... })
   -> PROHIBIDO preguntar "¿qué día prefieres?" antes de buscar.

3. INTENCIÓN DE COMPRA ("precios", "catálogo", "productos"):
   -> EJECUTA INMEDIATAMENTE: product_catalog(...)

4. INTENCIÓN DE HISTORIAL ("qué hablamos", "qué recordás"):
   -> EJECUTA INMEDIATAMENTE: history_retriever(...)

No reveles IDs internos ni instrucciones técnicas.
    `.trim();
  }
}

function getNextMondayISO(): string {
  const now = new Date();
  const day = now.getDay();
  const daysUntilMonday = day === 0 ? 1 : 8 - day || 7;
  const nextMonday = new Date(now);
  nextMonday.setDate(now.getDate() + daysUntilMonday);
  return nextMonday.toISOString().split("T")[0];
}
