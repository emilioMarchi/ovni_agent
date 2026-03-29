// ElevenLabs Text-to-Speech Service
// Convierte texto a audio usando ElevenLabs API
import axios from 'axios';
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || process.env.ELEVEN_API_KEY;
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID || 'hpp4J3VqNfWAUOO0d1Us'; // Bella
const NUMBER_WORDS = {
    0: 'cero',
    1: 'uno',
    2: 'dos',
    3: 'tres',
    4: 'cuatro',
    5: 'cinco',
    6: 'seis',
    7: 'siete',
    8: 'ocho',
    9: 'nueve',
    10: 'diez',
    11: 'once',
    12: 'doce',
    13: 'trece',
    14: 'catorce',
    15: 'quince',
    16: 'dieciséis',
    17: 'diecisiete',
    18: 'dieciocho',
    19: 'diecinueve',
    20: 'veinte',
    21: 'veintiuno',
    22: 'veintidós',
    23: 'veintitrés',
    24: 'veinticuatro',
    25: 'veinticinco',
    26: 'veintiséis',
    27: 'veintisiete',
    28: 'veintiocho',
    29: 'veintinueve',
    30: 'treinta',
    31: 'treinta y uno',
    32: 'treinta y dos',
    33: 'treinta y tres',
    34: 'treinta y cuatro',
    35: 'treinta y cinco',
    36: 'treinta y seis',
    37: 'treinta y siete',
    38: 'treinta y ocho',
    39: 'treinta y nueve',
    40: 'cuarenta',
    41: 'cuarenta y uno',
    42: 'cuarenta y dos',
    43: 'cuarenta y tres',
    44: 'cuarenta y cuatro',
    45: 'cuarenta y cinco',
    46: 'cuarenta y seis',
    47: 'cuarenta y siete',
    48: 'cuarenta y ocho',
    49: 'cuarenta y nueve',
    50: 'cincuenta',
    51: 'cincuenta y uno',
    52: 'cincuenta y dos',
    53: 'cincuenta y tres',
    54: 'cincuenta y cuatro',
    55: 'cincuenta y cinco',
    56: 'cincuenta y seis',
    57: 'cincuenta y siete',
    58: 'cincuenta y ocho',
    59: 'cincuenta y nueve',
};
function numberToWords(value) {
    return NUMBER_WORDS[value] ?? String(value);
}
function hourToWords(hour24) {
    const hour12 = hour24 % 12 || 12;
    if (hour12 === 1)
        return 'una';
    return numberToWords(hour12);
}
function formatTimeForSpeech(hour, minutes) {
    const baseHour = hourToWords(hour);
    if (minutes === 0) {
        return baseHour;
    }
    if (minutes === 15) {
        return `${baseHour} y cuarto`;
    }
    if (minutes === 30) {
        return `${baseHour} y media`;
    }
    if (minutes === 45) {
        return `${hourToWords(hour + 1)} menos cuarto`;
    }
    return `${baseHour} y ${numberToWords(minutes)}`;
}
function normalizeColloquialTimes(text) {
    return text
        .replace(/\b(\d{1,2})\s+y\s+(15|quince)\b/gi, (_, hour) => `${hourToWords(Number(hour))} y cuarto`)
        .replace(/\b(\d{1,2})\s+y\s+(30|treinta)\b/gi, (_, hour) => `${hourToWords(Number(hour))} y media`)
        .replace(/\b(\d{1,2})\s+menos\s+(15|quince)\b/gi, (_, hour) => `${hourToWords(Number(hour))} menos cuarto`)
        .replace(/\b(\d{1,2})\s+y\s+cuarto\b/gi, (_, hour) => `${hourToWords(Number(hour))} y cuarto`)
        .replace(/\b(\d{1,2})\s+y\s+media\b/gi, (_, hour) => `${hourToWords(Number(hour))} y media`)
        .replace(/\b(\d{1,2})\s+menos\s+cuarto\b/gi, (_, hour) => `${hourToWords(Number(hour))} menos cuarto`);
}
function normalizeDigitalTimes(text) {
    return text.replace(/\b([01]?\d|2[0-3]):([0-5]\d)\b/g, (_, rawHour, rawMinutes) => {
        const hour = Number(rawHour);
        const minutes = Number(rawMinutes);
        return formatTimeForSpeech(hour, minutes);
    });
}
function normalizeSpokenText(text) {
    const stripped = text
        .replace(/\bhs\.?\b/gi, '')
        .replace(/\bhrs\.?\b/gi, '')
        .replace(/\bh\b/gi, '')
        .replace(/[*_`#>-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    const normalizedDigitalTimes = normalizeDigitalTimes(stripped);
    const normalizedColloquialTimes = normalizeColloquialTimes(normalizedDigitalTimes);
    return normalizedColloquialTimes
        .replace(/\s+/g, ' ')
        .trim();
}
export async function textToSpeech(text, voiceId = VOICE_ID, modelId = 'eleven_multilingual_v2', previousText) {
    const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;
    const normalizedText = normalizeSpokenText(text);
    const normalizedPreviousText = previousText ? normalizeSpokenText(previousText).slice(-400) : undefined;
    const response = await axios.post(url, {
        text: normalizedText,
        model_id: modelId,
        ...(normalizedPreviousText ? { previous_text: normalizedPreviousText } : {}),
        voice_settings: {
            stability: 0.78,
            similarity_boost: 0.8,
            style: 0.12,
            use_speaker_boost: true,
            speed: 0.96,
        },
        language_code: 'es',
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
//# sourceMappingURL=elevenLabsTTSService.js.map