import { PromptCallback, ReadResourceCallback, ResourceMetadata, ToolCallback } from "@modelcontextprotocol/sdk/server/mcp";
import { ToolAnnotations } from "@modelcontextprotocol/sdk/types";
import { ZodRawShape } from "zod";

export interface MCPModule {
    name: string;
    type: 'tool' | 'resource' | 'prompt';
}

export interface MCPTool<InputArgs extends ZodRawShape, OutputArgs extends ZodRawShape> extends MCPModule {
    config: {
        title?: string;
        description?: string;
        inputSchema?: InputArgs;
        outputSchema?: OutputArgs;
        annotations?: ToolAnnotations;
        _meta?: Record<string, unknown>;
    }
    needAuthInfo?: boolean;
    type: 'tool';
    toolCallback?: ToolCallback<InputArgs>;
}

export interface MCPResource extends MCPModule {
    type: 'resource';
    uriOrTemplate: string;
    config: ResourceMetadata;
    readCallback: ReadResourceCallback;
}

export interface MCPPrompt<Args extends ZodRawShape> extends MCPModule {
    type: 'prompt';
    config: {
        title?: string;
        description?: string;
        argsSchema?: Args;
    }
    promptCallback: PromptCallback<Args>;
}