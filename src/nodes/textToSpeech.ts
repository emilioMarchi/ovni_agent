// Nodo para Text-to-Speech en el grafo OVNI
import { textToSpeech } from '../services/elevenLabsTTSService.js';
import { AgentStateType } from '../state/state.js';
import { AIMessage } from '@langchain/core/messages';

/**
 * Si outputAudio es true, convierte el último mensaje del asistente a audio
 * y lo guarda en state.audioBuffer. Si no, pasa sin cambios.
 */
export async function textToSpeechNode(state: AgentStateType) {
  if (!state.outputAudio) return {};

  const lastMsg = state.messages[state.messages.length - 1];
  if (lastMsg instanceof AIMessage && typeof lastMsg.content === 'string' && lastMsg.content) {
    try {
      const audioBuffer = await textToSpeech(lastMsg.content);
      return { audioBuffer };
    } catch (err) {
      console.error('❌ [TTS] Error generando audio:', err);
    }
  }
  return {};
}
