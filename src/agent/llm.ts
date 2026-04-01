import { config } from '../config.js';
import { getDefinitions } from './tools.js';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.3-70b-versatile';

export interface LLMResponse {
  message: {
    role: string;
    content: string | null;
    tool_calls?: any[];
  };
}

export async function chatCompletion(messages: any[]): Promise<LLMResponse> {
  const tools = getDefinitions();
  const payload: any = {
    model: MODEL,
    messages,
    temperature: 0.7,
    max_tokens: 1024,
  };

  console.log(`[LLM DEBUG] Primer mensaje:`, JSON.stringify(messages[0]).substring(0, 300));
  console.log(`[LLM DEBUG] Mensajes enviados:`, messages.length);

  if (tools.length > 0) {
    payload.tools = tools;
  }

  console.log(`[LLM] Enviando ${messages.length} mensajes a Groq (${MODEL})...`);

  const response = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.GROQ_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[LLM ERROR] ${response.status}: ${errorText}`);
    throw new Error(`Groq API Error: ${response.status} - ${errorText}`);
  }

  const data: any = await response.json();
  const msg = data.choices?.[0]?.message;

  if (!msg) {
    console.error('[LLM ERROR] Respuesta sin message:', JSON.stringify(data).substring(0, 500));
    return { message: { role: 'assistant', content: 'Error: no recibí respuesta del modelo.' } };
  }

  console.log(`[LLM OK] Tokens: ${data.usage?.total_tokens || '?'}`);
  console.log(`[LLM DEBUG] Respuesta completa:`, JSON.stringify(msg).substring(0, 500));
  return { message: msg };
}
