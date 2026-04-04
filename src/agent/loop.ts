import { addMessage, getChatHistory } from '../memory/db.js';
import { executeTool } from './tools.js';
import { chatCompletion, LLMResponse } from './llm.js';

const SYSTEM_PROMPT = `Eres MiguelAI, un asistente personal inteligente, amigable y conversacional. 
Tu creador es Lenon. Siempre respondes en español.
Eres directo pero cálido. Si no sabes algo, lo dices honestamente.
Puedes usar herramientas (tools) cuando sea necesario.
IMPORTANTE: SIEMPRE debes responder con texto al usuario, nunca dejes la respuesta vacía.`;

const MAX_ITERATIONS = 5;

export async function runAgentLoop(userId: number, initialMessage: string): Promise<string> {
  // Add the user message to memory
  await addMessage({
    user_id: userId,
    role: 'user',
    content: initialMessage
  });

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const history = await getChatHistory(userId, 6);
    
    const messages: any[] = [
      { role: 'system', content: SYSTEM_PROMPT }
    ];

    // Add history, filtering out invalid messages
    for (const msg of history) {
      if (msg.role === 'tool') {
        messages.push({
          role: 'tool',
          content: msg.content || '',
          tool_call_id: msg.tool_call_id || 'unknown'
        });
      } else if (msg.role === 'assistant') {
        const m: any = { role: 'assistant', content: msg.content || '' };
        if (msg.tool_calls) {
          try {
            m.tool_calls = typeof msg.tool_calls === 'string' ? JSON.parse(msg.tool_calls) : msg.tool_calls;
          } catch (e) {
            console.error('Error parsing tool_calls from history', e);
          }
        }
        messages.push(m);
      } else if (msg.role === 'user') {
        messages.push({ role: 'user', content: msg.content || '' });
      }
    }

    console.log(`[LOOP] Iteración ${i + 1}, mensajes: ${messages.length}`);

    let response: LLMResponse;
    try {
      response = await chatCompletion(messages);
    } catch (err: any) {
      console.error('[LOOP ERROR]', err.message);
      return `Lo siento, tuve un error al pensar: ${err.message}`;
    }

    const aiMessage = response.message;
    console.log(`[LOOP] Respuesta IA — content: "${aiMessage.content?.substring(0, 100) || '(vacío)'}", tool_calls: ${aiMessage.tool_calls?.length || 0}`);

    // Save to DB
    await addMessage({
      user_id: userId,
      role: 'assistant',
      content: aiMessage.content || '',
      tool_calls: aiMessage.tool_calls ? JSON.stringify(aiMessage.tool_calls) : undefined
    });

    if (aiMessage.tool_calls && aiMessage.tool_calls.length > 0) {
      for (const call of aiMessage.tool_calls) {
        if (call.type === 'function') {
          const fnName = call.function.name;
          const fnArgs = call.function.arguments;
          console.log(`[TOOL] Ejecutando: ${fnName}`);
          
          let resultStr = "";
          try {
            resultStr = await executeTool(fnName, fnArgs);
          } catch(e: any) {
            resultStr = `Error: ${e.message}`;
          }

          await addMessage({
            user_id: userId,
            role: 'tool',
            content: resultStr,
            tool_call_id: call.id
          });
        }
      }
      // Continue loop
    } else {
      // Final text response
      const finalText = aiMessage.content?.trim();
      if (finalText) {
        return finalText;
      }
      return "Hmm, no pude generar una respuesta. ¿Puedes reformular tu pregunta?";
    }
  }

  return "Llegué al máximo de iteraciones de pensamiento.";
}
