// ElevenLabs Text-to-Speech Service
// Convierte texto a audio usando ElevenLabs API
import axios from 'axios';

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID || 'EXAVITQu4vr4xnSDxMaL'; // Cambia por tu voz preferida

export async function textToSpeech(text: string, voiceId: string = VOICE_ID, modelId: string = 'eleven_multilingual_v2') {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;
  const response = await axios.post(url, {
    text,
    model_id: modelId,
    voice_settings: { stability: 0.5, similarity_boost: 0.7 }
  }, {
    responseType: 'arraybuffer',
    headers: {
      'xi-api-key': ELEVENLABS_API_KEY,
      'Content-Type': 'application/json',
      'Accept': 'audio/mpeg'
    }
  });
  return response.data; // Buffer de audio (mp3)
}

// Uso:
// const audioBuffer = await textToSpeech('Hola, ¿cómo estás?');
