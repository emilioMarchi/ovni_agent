// Nodo para Speech-to-Text en el grafo OVNI
import { speechToText } from '../services/speechToTextService.js';
import { AgentStateType } from '../state/state.js';

/**
 * Si la entrada es audio, convierte a texto y lo agrega a state.messages.
 * Si no, pasa el estado sin cambios.
 */
export async function speechToTextNode(state: AgentStateType) {
  const lastMsg = state.messages[state.messages.length - 1];
  if (lastMsg && lastMsg.type === 'audio' && lastMsg.audioBuffer) {
    const transcript = await speechToText(lastMsg.audioBuffer);
    // Reemplaza el mensaje de audio por uno de texto
    const newMessages = state.messages.slice(0, -1).concat({
      ...lastMsg,
      type: 'text',
      content: transcript,
      transcript,
    });
    return { ...state, messages: newMessages };
  }
  return state;
}
