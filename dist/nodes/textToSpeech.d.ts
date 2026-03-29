import { AgentStateType } from '../state/state.js';
/**
 * Si outputAudio es true, convierte el último mensaje del asistente a audio
 * y lo guarda en state.audioBuffer. Si no, pasa sin cambios.
 */
export declare function textToSpeechNode(state: AgentStateType): Promise<{
    audioBuffer?: undefined;
} | {
    audioBuffer: any;
}>;
