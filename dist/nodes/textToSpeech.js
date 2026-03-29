// Nodo para Text-to-Speech en el grafo OVNI
import { textToSpeech } from '../services/elevenLabsTTSService.js';
import { AIMessage } from '@langchain/core/messages';
function condenseForSpeech(content) {
    const flattened = content
        .replace(/```[\s\S]*?```/g, ' ')
        .replace(/[*_`#]/g, ' ')
        .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
        .replace(/\n+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    if (flattened.length <= 220) {
        return flattened;
    }
    const sentences = flattened
        .split(/(?<=[.!?])\s+/)
        .map((sentence) => sentence.trim())
        .filter(Boolean);
    const selected = [];
    let totalLength = 0;
    for (const sentence of sentences) {
        const nextLength = totalLength + sentence.length + (selected.length > 0 ? 1 : 0);
        if (selected.length >= 2 || nextLength > 220) {
            break;
        }
        selected.push(sentence);
        totalLength = nextLength;
    }
    if (selected.length === 0) {
        return `${flattened.slice(0, 200).trim()}.`;
    }
    return selected.join(' ');
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
            const spokenText = condenseForSpeech(lastMsg.content);
            const previousAssistantMessage = [...state.messages]
                .slice(0, -1)
                .reverse()
                .find((message) => message instanceof AIMessage && typeof message.content === 'string' && message.content);
            const audioBuffer = await textToSpeech(spokenText, undefined, undefined, previousAssistantMessage instanceof AIMessage && typeof previousAssistantMessage.content === 'string'
                ? condenseForSpeech(previousAssistantMessage.content)
                : undefined);
            return { audioBuffer };
        }
        catch (err) {
            console.error('❌ [TTS] Error generando audio:', err);
        }
    }
    return {};
}
//# sourceMappingURL=textToSpeech.js.map