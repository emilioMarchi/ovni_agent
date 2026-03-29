// Nodo para Speech-to-Text en el grafo OVNI
import { speechToText } from '../services/speechToTextService.js';
import { AgentStateType } from '../state/state.js';
import { HumanMessage } from '@langchain/core/messages';

/**
 * Si el estado tiene un audioBuffer pendiente, lo convierte a texto
 * y lo agrega como mensaje de usuario. Si no, pasa sin cambios.
 */
export async function speechToTextNode(state: AgentStateType) {
  // Verificar que sea un Buffer real (no objeto serializado del checkpoint)
  if (state.audioBuffer && Buffer.isBuffer(state.audioBuffer)) {
    console.log(`🎙️ [STT] Buffer recibido: ${state.audioBuffer.byteLength} bytes`);
    const transcript = await speechToText(state.audioBuffer, 'WEBM_OPUS', 48000);
    console.log(`🎙️ [STT] Transcripción: "${transcript}"`);
    if (!transcript.trim()) {
      console.warn('🎙️ [STT] Transcripción vacía, descartando audio');
      return { audioBuffer: null };
    }
    return {
      messages: [new HumanMessage(transcript)],
      audioBuffer: null,
    };
  }
  if (state.audioBuffer) {
    // Objeto serializado del checkpoint, limpiar
    console.warn('🎙️ [STT] audioBuffer no es un Buffer real, limpiando estado');
  }
  return { audioBuffer: null };
}
