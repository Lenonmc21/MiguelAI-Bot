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

  // Solo agregar tools si existen
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
  
  console.log(`[LLM DEBUG] Raw response:`, JSON.stringify(data).substring(0, 800));
  
  const msg = data.choices?.[0]?.message;

  if (!msg) {
    console.error('[LLM ERROR] Respuesta sin message:', JSON.stringify(data).substring(0, 500));
    return { message: { role: 'assistant', content: 'Error: no recibí respuesta del modelo.' } };
  }

  // Si content está vacío, verificar si es respuesta de tool
  if (!msg.content && msg.tool_calls) {
    console.log('[LLM DEBUG] Respuesta con tool_calls pero sin content');
    return { message: msg };
  }

  if (!msg.content || msg.content.trim() === '') {
    console.log('[LLM DEBUG] Content vacío, forzando respuesta por defecto');
    return { message: { role: 'assistant', content: 'Sí, te escucho y entiendo. ¿En qué puedo ayudarte?' } };
  }

  console.log(`[LLM OK] Tokens: ${data.usage?.total_tokens || '?'}`);
  return { message: msg };
}
