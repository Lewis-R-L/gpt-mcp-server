import { MCPTool } from "../../interfaces";

const PING_TOOL: MCPTool<undefined, undefined> = {
    name: 'ping',
    type: 'tool',
    config: {
        title: 'Ping',
        description: 'Ping the server',
        annotations: {
            tags: ['system', 'test'],
        },
    },
    toolCallback: async () => {
        return { content: [{ type: 'text', text: 'pong' }] };
    }
};

export default PING_TOOL;