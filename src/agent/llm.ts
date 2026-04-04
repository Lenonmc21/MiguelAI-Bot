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

  if (tools.length > 0) {
    payload.tools = tools;
    payload.tool_choice = "auto";
  }

  console.log(`[LLM] Enviando ${messages.length} mensajes a Groq (${MODEL})...`);

  let response = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.GROQ_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    if (response.status === 429 && config.OPENROUTER_API_KEY) {
      console.log('[LLM] Groq Rate Limit (429) detectado. Usando OpenRouter (Fallback)...');
      const orPayload = { ...payload, model: 'meta-llama/llama-3.1-8b-instruct:free' };
      
      response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://github.com/Lenon/MiguelAI',
          'X-Title': 'MiguelAI'
        },
        body: JSON.stringify(orPayload)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenRouter Fallback Error: ${response.status} - ${errorText}`);
      }
    } else {
      const errorText = await response.text();
      console.error(`[LLM ERROR] ${response.status}: ${errorText}`);
      throw new Error(`Groq API Error: ${response.status} - ${errorText}`);
    }
  }

  const data: any = await response.json();
  const msg = data.choices?.[0]?.message;

  if (!msg) {
    console.error('[LLM ERROR] Respuesta sin message:', JSON.stringify(data).substring(0, 500));
    return { message: { role: 'assistant', content: 'Error: no recibí respuesta del modelo.' } };
  }

  console.log(`[LLM OK] Tokens: ${data.usage?.total_tokens || '?'}`);
  return { message: msg };
}
