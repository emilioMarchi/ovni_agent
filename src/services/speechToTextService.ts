// Google Speech-to-Text Service
// Convierte audio (buffer) a texto usando Google Cloud Speech
import { SpeechClient } from '@google-cloud/speech';
import fs from 'fs';

const client = new SpeechClient();

export async function speechToText(audioBuffer: Buffer, encoding: string = 'LINEAR16', sampleRateHertz: number = 16000, languageCode: string = 'es-AR'): Promise<string> {
  const audio = { content: audioBuffer.toString('base64') };
  const config = { encoding, sampleRateHertz, languageCode };
  const request = { audio, config };
  const [response] = await client.recognize(request);
  const transcription = response.results?.map(r => r.alternatives?.[0]?.transcript).join(' ') || '';
  return transcription;
}

// Uso:
// const text = await speechToText(fs.readFileSync('audio.wav'));
