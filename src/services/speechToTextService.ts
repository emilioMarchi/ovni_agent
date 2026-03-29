// Speech-to-Text Service usando Google Cloud Speech-to-Text
import speech from '@google-cloud/speech';

const sttClient = new speech.SpeechClient();

export async function speechToText(audioBuffer: Buffer, _mimeType?: string, _sampleRate?: number, languageCode: string = 'es-ES'): Promise<string> {
  const request = {
    audio: { content: audioBuffer.toString('base64') },
    config: {
      encoding: 'WEBM_OPUS' as const,
      sampleRateHertz: 48000,
      languageCode,
    },
  };

  const [response] = await sttClient.recognize(request);

  if (!response.results || response.results.length === 0) return '';

  return response.results
    .map(r => r.alternatives?.[0]?.transcript ?? '')
    .join(' ');
}
