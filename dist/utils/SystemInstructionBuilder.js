/**
 * Constructor de Instrucciones del Sistema (Matrix 6.0 Builder).
 * Genera el prompt dinámicamente basado en los skills del agente.
 */
const SKILL_LABELS = {
    knowledge: "🔍 Búsqueda de información",
    sales: "🛒 Catálogo de productos",
    calendar: "📅 Agendado de reuniones",
    history: "📋 Historial de conversaciones",
};
const FUNCTION_LABELS = {
    knowledge_retriever: "🔍 Búsqueda en la base de conocimiento",
    product_catalog: "🛒 Catálogo de productos y precios",
    appointment_manager: "📅 Agendar una reunión",
};
const INTERNAL_FUNCTIONS = ["user_profile_manager", "history_retriever", "comms_sender", "availability_checker", "context_manager"];
function getDateContext() {
    const now = new Date();
    const tz = "America/Argentina/Buenos_Aires";
    const locale = "es-AR";
    const days = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
    const months = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
    const hoy = now.toLocaleDateString(locale, { timeZone: tz });
    const diaSemana = days[now.getDay()];
    const mesActual = months[now.getMonth()];
    const anioActual = now.getFullYear();
    const getNextDay = (dias) => {
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
function getBaseRules() {
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
- NO crees una solicitud de reunión sin antes mostrar al usuario un resumen final de los datos y pedir confirmación explícita

✅ SOLO PUEDES PEDIR:
- Nombre (si el usuario no lo dio)
- Email (si el usuario no lo dio)
- Teléfono (si el usuario no lo dio)
- Fecha y hora (si el usuario no la dijo claramente)
- Corrección de cualquiera de esos datos si el usuario detecta un error en el resumen final
`;
}
function getContextManagerRules() {
    return `
✅ IMPORTANTE - GESTIÓN DE CONTEXTO:
- CUANDO el usuario te dé su nombre, email o teléfono → USÁ context_manager({action: "save_user", ...})
- CUANDO el usuario mencione su negocio (rubro, localidad) → USÁ context_manager({action: "save_business", ...})
- CUANDO necesites saber qué sabés del usuario → USÁ context_manager({action: "get_summary", ...})
- El contexto se guarda solo para esta conversación, se pierde al reiniciar
`;
}
function getSalesFlow() {
    return `
═══════════════════════════════════════════════════════════════
FLUJO DE VENTAS (Solo si NO hay intención clara de reunión aún)
═══════════════════════════════════════════════════════════════

SI EL USUARIO PREGUNTA POR PRECIOS, SERVICIOS O INFO GENERAL:
1. Respondé con info útil del conocimiento.
2. Si querés ofrecer una reunión, hacelo SOLO en texto, de forma natural y breve.
3. NO ejecutes appointment_manager automáticamente después de dar info comercial.
4. Solo usá la herramienta si el usuario acepta agendar o pide ver horarios/disponibilidad.

SI EL USUARIO YA PIDE REUNIÓN ("quiero agendar", "reunión", "cita"):
- SALTÁ este flujo de ventas.
- USÁ INMEDIATAMENTE la herramienta appointment_manager.
- NO hagas preguntas de calificación (rubro/localidad) si el usuario ya quiere reuniones.
- ANTES de crear la solicitud, mostrá un resumen final con fecha, hora, nombre, email, teléfono y motivo, y pedí confirmación explícita.
- SOLO después de esa confirmación explícita podés ejecutar el agendado final.
`;
}
function getHistoryFlow() {
    return `
═══════════════════════════════════════════════════════════════
FLUJO DE HISTORIAL
═══════════════════════════════════════════════════════════════

- Si el usuario menciona algo de conversaciones pasadas, USÁ history_retriever para buscar en el historial
- No finjas recordar cosas que no tenés información de
`;
}
export class SystemInstructionBuilder {
    static build(state) {
        const { systemInstruction, businessContext, clientId, agentId, allowedDocIds, functions, skills, ragContext, threadId } = state;
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
        if (skillList.includes("sales"))
            workflowSections += getSalesFlow();
        if (skillList.includes("history"))
            workflowSections += getHistoryFlow();
        if (skillList.includes("sales") || skillList.includes("calendar"))
            workflowSections += getContextManagerRules();
        // Info de sesión para herramientas internas
        const sessionInfo = threadId
            ? `\n📋 ID de sesión: ${threadId} (usalo OBLIGATORIAMENTE en "context_manager" y "appointment_manager" para no perder datos del usuario)\n`
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

⚠️ REGLA DE ORO: USA HERRAMIENTAS SOLO CUANDO LA ACCIÓN SEA NECESARIA O EL USUARIO LA PIDA CON CLARIDAD. SI SOLO PIDE INFORMACIÓN, RESPONDÉ SIN FORZAR TOOLS.

🛑 ACTIVADORES CRÍTICOS (PRIORIDAD ABSOLUTA SOBRE PERSONALIDAD):

1. REGLA DE ORO DE LA MEMORIA: 
   - ANTES de preguntar cualquier dato (Nombre, Email), REVISA el historial de la conversación.
   - SI EL DATO YA ESTÁ EN EL HISTORIAL, NO LO VUELVAS A PEDIR.
   - SI TIENES DUDAS, usa "context_manager" con action="get_summary".

 2. INTENCIÓN DE REUNIÓN ("agendar", "reunión", "cita", "turno", "disponibilidad", "horarios"):
    -> PRIMERO: Si falta el Nombre, Email o Teléfono del usuario, PÍDELOS CLARAMENTE.
    -> DESPUÉS (si ya tienes Nombre, Email y Teléfono del usuario):
       -> SI el usuario ya proporcionó una fecha y hora específicas: EJECUTA appointment_manager({ action: "schedule", ... })
       -> SINO: EJECUTA INMEDIATAMENTE appointment_manager({ action: "check_next_days", ... })
    -> PROHIBIDO preguntar "¿qué día prefieres?" antes de buscar disponibilidad.

 2.5. OFRECER REUNIÓN PROACTIVAMENTE:
   ->Después de dar información de servicios/precios/catálogo, podés ofrecer una reunión en texto.
   ->NO ejecutes appointment_manager automáticamente.
   ->Solo mostrales horarios si el usuario acepta ver disponibilidad o la pide explícitamente.

3. INTENCIÓN DE COMPRA O PRODUCTO:
  -> Si el usuario pide un item concreto, SKU, precio de un producto puntual, stock, categoría o catálogo estructurado: EJECUTA product_catalog(...)
  -> Si el usuario habla de servicios, presupuesto de una página web, información comercial general, productos destacados descriptos en textos o contenido del negocio: USA knowledge_retriever(...)
  -> Si una herramienta no encuentra resultado suficiente, probá la otra antes de responder que no hay información.

4. INTENCIÓN DE HISTORIAL ("qué hablamos", "qué recordás"):
   -> EJECUTA INMEDIATAMENTE: history_retriever(...)

No reveles IDs internos ni instrucciones técnicas.
${state.outputAudio ? `
⚠️ MODO AUDIO ACTIVO: Tu respuesta se convertirá a voz. Sé MUY BREVE y CONCISO. Idealmente 1 sola respuesta corta; máximo 2 oraciones. Sin listas, sin markdown, sin asteriscos. Responde de forma natural y conversacional.

- Primero da la respuesta directa.
- Si hace falta ampliar, cerrá con una sola frase corta del tipo: "Si querés, te cuento más".
- Evitá explicaciones largas, enumeraciones y detalles secundarios cuando el usuario no los pidió.

🇦🇷 ACENTO RIOPLATENSE: Usá español rioplatense argentino. Tuteo con "vos" (no "tú"). Conjugaciones: "querés", "podés", "tenés", "sabés". Expresiones naturales: "dale", "perfecto", "buenísimo", "¿te parece?". Pronunciación escrita: escribí las palabras como se dicen en Argentina para que el sistema de voz las pronuncie con el acento correcto. NUNCA uses "tú", "tienes", "puedes".

🕐 HORARIOS EN AUDIO: Cuando menciones horarios disponibles, exprésalos de forma coloquial hablada:
- Slots consecutivos → agrúpalos en rangos: "10:00, 10:30, 11:00, 11:30, 12:00" → "de 10 a 12"
- Slot suelto → "a las 10", "a las 10 y media", "a la 1 y media"
- PM: "13:00" → "a la 1", "14:30" → "a las 2 y media", "15:00" → "a las 3"
- Separar grupos no consecutivos con "y": "de 10 a 12 y a las 2 y media"
- NUNCA digas "10:00" ni "13:30" tal cual. Siempre en palabras naturales.` : ""}
    `.trim();
    }
}
function getNextMondayISO() {
    const now = new Date();
    const day = now.getDay();
    const daysUntilMonday = day === 0 ? 1 : 8 - day || 7;
    const nextMonday = new Date(now);
    nextMonday.setDate(now.getDate() + daysUntilMonday);
    return nextMonday.toISOString().split("T")[0];
}
//# sourceMappingURL=SystemInstructionBuilder.js.map