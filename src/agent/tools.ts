export interface ToolDef {
  type: string;
  function: {
    name: string;
    description: string;
    parameters: any;
  };
}

type ToolFunction = (args: any) => Promise<string> | string;

const registry = new Map<string, ToolFunction>();
const definitions: ToolDef[] = [];

// Helper to register a tool
export function registerTool(
  def: ToolDef,
  impl: ToolFunction
) {
  registry.set(def.function.name, impl);
  definitions.push(def);
}

// System tool definitions
export function getDefinitions() {
  return definitions;
}

// Safe execution of tools
export async function executeTool(name: string, argsStr: string): Promise<string> {
  const impl = registry.get(name);
  if (!impl) {
    return `Error: Tool ${name} not found.`;
  }
  try {
    const args = JSON.parse(argsStr);
    const result = await impl(args);
    return typeof result === 'string' ? result : JSON.stringify(result);
  } catch (err: any) {
    return `Error executing tool ${name}: ${err.message}`;
  }
}

// ---------------------------
// 1. Tool: get_current_time
// ---------------------------
registerTool(
  {
    type: "function",
    function: {
      name: "get_current_time",
      description: "Gets the current date and time in ISO format.",
      parameters: {
        type: "object",
        properties: {},
        required: []
      }
    }
  },
  () => {
    return new Date().toISOString();
  }
);
