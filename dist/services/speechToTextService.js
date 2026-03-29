// Speech-to-Text Service usando Google Cloud Speech-to-Text
import speech from '@google-cloud/speech';
const sttClient = new speech.SpeechClient();
export async function speechToText(audioBuffer, _mimeType, _sampleRate, languageCode = 'es-ES') {
    const request = {
        audio: { content: audioBuffer.toString('base64') },
        config: {
            encoding: 'WEBM_OPUS',
            sampleRateHertz: 48000,
            languageCode,
        },
    };
    const [response] = await sttClient.recognize(request);
    if (!response.results || response.results.length === 0)
        return '';
    return response.results
        .map(r => r.alternatives?.[0]?.transcript ?? '')
        .join(' ');
}
//# sourceMappingURL=speechToTextService.js.map