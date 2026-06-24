/**
 * MCP SDK type shims for when npm tar extraction on NAS drops .d.ts files.
 * These declare the modules so TypeScript can find them even without
 * the actual declaration files.
 * 
 * TODO: Remove once the SDK is properly installed with all .d.ts files.
 */

declare module '@modelcontextprotocol/sdk/server/index.js' {
    export { Server } from '@modelcontextprotocol/sdk/server';
}

declare module '@modelcontextprotocol/sdk/server/sse.js' {
    export { SSEServerTransport } from '@modelcontextprotocol/sdk/server';
}

declare module '@modelcontextprotocol/sdk/server/stdio.js' {
    export { StdioServerTransport } from '@modelcontextprotocol/sdk/server';
}

declare module '@modelcontextprotocol/sdk/types.js' {
    import { ZodType } from 'zod';
    
    export const CallToolRequestSchema: ZodType;
    export const ListToolsRequestSchema: ZodType;
    export const ListResourcesRequestSchema: ZodType;
    export const ListResourceTemplatesRequestSchema: ZodType;
    export const ReadResourceRequestSchema: ZodType;
    export const ListPromptsRequestSchema: ZodType;
    export const GetPromptRequestSchema: ZodType;
    
    export interface CallToolRequest {
        params: {
            name: string;
            arguments?: Record<string, unknown>;
        };
    }
    
    export interface ListToolsRequest {
        params?: Record<string, unknown>;
    }
}

declare module '@modelcontextprotocol/sdk/server' {
    import { ZodType } from 'zod';
    
    export interface ServerOptions {
        name: string;
        version: string;
        capabilities?: Record<string, unknown>;
    }
    
    export interface RequestHandler<T = any> {
        (request: T): Promise<any>;
    }
    
    export class Server {
        constructor(options: ServerOptions, config?: { capabilities?: Record<string, unknown> });
        setRequestHandler(schema: any, handler: RequestHandler): void;
        connect(transport: any): Promise<void>;
        close(): Promise<void>;
        sendLoggingMessage(message: any): void;
        onerror: ((error: Error) => void) | undefined;
    }
    
    export class SSEServerTransport {
        constructor(path: string, res: any);
        handlePostMessage(req: any, res: any): Promise<void>;
        readonly sessionId: string;
    }
    
    export class StdioServerTransport {
        constructor();
    }
}
