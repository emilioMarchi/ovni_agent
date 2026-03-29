import { AgentStateType } from '../state/state.js';
import { HumanMessage } from '@langchain/core/messages';
/**
 * Si el estado tiene un audioBuffer pendiente, lo convierte a texto
 * y lo agrega como mensaje de usuario. Si no, pasa sin cambios.
 */
export declare function speechToTextNode(state: AgentStateType): Promise<{
    audioBuffer: null;
    messages?: undefined;
} | {
    messages: HumanMessage[];
    audioBuffer: null;
}>;
