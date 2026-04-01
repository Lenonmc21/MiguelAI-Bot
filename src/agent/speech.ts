import { config } from '../config.js';

const GROQ_TRANSCRIPTION_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';
const MODEL = 'whisper-large-v3';

export async function transcribeAudio(fileBuffer: Buffer, mimeType?: string): Promise<string> {
  const formData = new FormData();
  // Usar Uint8Array como BlobPart (compatible con Node.js y navegadores)
  const blob = new Blob([new Uint8Array(fileBuffer)], { type: mimeType || 'audio/ogg' });
  formData.append('file', blob, 'audio.ogg');
  formData.append('model', MODEL);
  // Important parameters: response_format text is easier, but json is fine.
  formData.append('response_format', 'json');

  const response = await fetch(GROQ_TRANSCRIPTION_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.GROQ_API_KEY}`,
    },
    body: formData as any // bypass type checking on formData to cross Node/web environments if needed
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Groq Transcription Error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.text;
}
