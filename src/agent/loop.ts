import { addMessage, getChatHistory } from '../memory/db.js';
import { executeTool } from './tools.js';
import { chatCompletion, LLMResponse } from './llm.js';

const SYSTEM_PROMPT = "You are MiguelAI, a highly capable personal AI agent. Be concise, direct, and helpful. You operate correctly through tools if required. You are running locally and talking through Telegram.";
const MAX_ITERATIONS = 5;

// The main loop that returns the final message string
export async function runAgentLoop(userId: number, initialMessage: string): Promise<string> {
  // Add the user message to memory
  await addMessage({
    user_id: userId,
    role: 'user',
    content: initialMessage
  });

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const history = await getChatHistory(userId, 20); // Last 20 messages for context
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...history.map(msg => ({
        role: msg.role,
        content: msg.content || null,
        tool_calls: msg.tool_calls || undefined,
        tool_call_id: msg.tool_call_id || undefined
      }))
    ];

    let response: LLMResponse;
    try {
      response = await chatCompletion(messages);
    } catch (err: any) {
      return `I'm sorry, I encountered an error communicating with my brain: ${err.message}`;
    }

    const aiMessage = response.message;
    
    // Save to DB
    await addMessage({
      user_id: userId,
      role: 'assistant',
      content: aiMessage.content || '',
      tool_calls: aiMessage.tool_calls ? JSON.stringify(aiMessage.tool_calls) : undefined
    });

    if (aiMessage.tool_calls && aiMessage.tool_calls.length > 0) {
      // Need to execute tools
      for (const call of aiMessage.tool_calls) {
        if (call.type === 'function') {
          const fnName = call.function.name;
          const fnArgs = call.function.arguments;
          
          let resultStr = "";
          try {
             resultStr = await executeTool(fnName, fnArgs);
          } catch(e: any) {
             resultStr = `Error: ${e.message}`;
          }

          // Add tool response to memory
          await addMessage({
             user_id: userId,
             role: 'tool',
             content: resultStr,
             tool_call_id: call.id
          });
        }
      }
      // Continue loop to send tool output to AI
    } else {
      // Final text response
      return aiMessage.content || "I don't have anything to say.";
    }
  }

  return "I reached the maximum number of thinking iterations.";
}
