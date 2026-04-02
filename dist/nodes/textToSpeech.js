// Nodo para Text-to-Speech en el grafo OVNI
import { textToSpeech } from '../services/elevenLabsTTSService.js';
import { AIMessage } from '@langchain/core/messages';
function normalizeForSpeech(content) {
    return content
        .replace(/```[\s\S]*?```/g, ' ')
        .replace(/[*_`#]/g, ' ')
        .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
        .replace(/^\s*[-•]\s+/gm, '')
        .replace(/\n+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}
/**
 * Si outputAudio es true, convierte el último mensaje del asistente a audio
 * y lo guarda en state.audioBuffer. Si no, pasa sin cambios.
 */
export async function textToSpeechNode(state) {
    if (!state.outputAudio)
        return {};
    const lastMsg = state.messages[state.messages.length - 1];
    if (lastMsg instanceof AIMessage && typeof lastMsg.content === 'string' && lastMsg.content) {
        try {
            const spokenText = normalizeForSpeech(lastMsg.content);
            const previousAssistantMessage = [...state.messages]
                .slice(0, -1)
                .reverse()
                .find((message) => message instanceof AIMessage && typeof message.content === 'string' && message.content);
            const audioBuffer = await textToSpeech(spokenText, undefined, undefined, previousAssistantMessage instanceof AIMessage && typeof previousAssistantMessage.content === 'string'
                ? normalizeForSpeech(previousAssistantMessage.content)
                : undefined);
            return {
                messages: [new AIMessage({
                        content: spokenText,
                        additional_kwargs: lastMsg.additional_kwargs,
                        response_metadata: lastMsg.response_metadata,
                        id: lastMsg.id,
                        tool_calls: lastMsg.tool_calls,
                    })],
                audioBuffer,
            };
        }
        catch (err) {
            // Simplificar log de errores de ElevenLabs para no volcar el AxiosError completo
            if (err?.response?.status === 401) {
                const detail = err.response.data
                    ? JSON.parse(Buffer.from(err.response.data).toString('utf-8'))
                    : {};
                if (detail?.detail?.status === 'quota_exceeded') {
                    console.warn('⚠️ [TTS] Cuota de ElevenLabs excedida. El texto se enviará sin audio.');
                }
                else {
                    console.warn(`⚠️ [TTS] ElevenLabs 401 Unauthorized: ${detail?.detail?.message || 'API key inválida o sin permisos'}`);
                }
            }
            else if (err?.response?.status) {
                console.error(`❌ [TTS] Error ${err.response.status} de ElevenLabs: ${err.message}`);
            }
            else {
                console.error('❌ [TTS] Error generando audio:', err?.message || err);
            }
        }
    }
    return {};
}
//# sourceMappingURL=textToSpeech.js.map