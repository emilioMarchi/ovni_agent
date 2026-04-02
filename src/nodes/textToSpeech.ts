// Nodo para Text-to-Speech en el grafo OVNI
import { textToSpeech } from '../services/elevenLabsTTSService.js';
import { AgentStateType } from '../state/state.js';
import { AIMessage } from '@langchain/core/messages';

function normalizeForSpeech(content: string): string {
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
export async function textToSpeechNode(state: AgentStateType) {
  if (!state.outputAudio) return {};

  const lastMsg = state.messages[state.messages.length - 1];
  if (lastMsg instanceof AIMessage && typeof lastMsg.content === 'string' && lastMsg.content) {
    try {
      const spokenText = normalizeForSpeech(lastMsg.content);
      const previousAssistantMessage = [...state.messages]
        .slice(0, -1)
        .reverse()
        .find((message) => message instanceof AIMessage && typeof message.content === 'string' && message.content);

      const audioBuffer = await textToSpeech(
        spokenText,
        undefined,
        undefined,
        previousAssistantMessage instanceof AIMessage && typeof previousAssistantMessage.content === 'string'
          ? normalizeForSpeech(previousAssistantMessage.content)
          : undefined,
      );

      return {
        messages: [new AIMessage({
          content: spokenText,
          additional_kwargs: lastMsg.additional_kwargs,
          response_metadata: lastMsg.response_metadata,
          id: lastMsg.id,
          tool_calls: (lastMsg as any).tool_calls,
        })],
        audioBuffer,
      };
    } catch (err) {
      console.error('❌ [TTS] Error generando audio:', err);
    }
  }
  return {};
}
