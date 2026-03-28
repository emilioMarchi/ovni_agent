// Nodo para Text-to-Speech en el grafo OVNI
import { textToSpeech } from '../services/elevenLabsTTSService.js';
import { AgentStateType } from '../state/state.js';

/**
 * Si la salida requiere audio (por preferencia del usuario o entrada de audio),
 * convierte el último mensaje de texto a audio y lo adjunta.
 */
export async function textToSpeechNode(state: AgentStateType) {
  const lastMsg = state.messages[state.messages.length - 1];
  // Condición: si el usuario lo solicita o si la entrada fue audio
  if (state.outputAudio || (state.messages[0] && state.messages[0].type === 'audio')) {
    if (lastMsg && lastMsg.type === 'text' && lastMsg.content) {
      const audioBuffer = await textToSpeech(lastMsg.content);
      // Adjunta el audio al mensaje de salida
      const newMessages = state.messages.slice(0, -1).concat({
        ...lastMsg,
        audioBuffer,
        audioFormat: 'mp3',
      });
      return { ...state, messages: newMessages };
    }
  }
  return state;
}
