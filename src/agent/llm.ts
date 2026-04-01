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
  };

  if (tools.length > 0) {
    payload.tools = tools;
    payload.tool_choice = "auto";
  }

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
    throw new Error(`Groq API Error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return { message: data.choices[0].message };
}
