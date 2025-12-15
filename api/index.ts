// Vercel Serverless Function 入口文件
// 这个文件将 Express 应用导出为 Vercel 函数

import express from 'express';
import { randomUUID } from 'node:crypto';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

import { MCP_MODULES } from '../mcp-server/src/mcp-modules';
import { MCPPrompt, MCPResource, MCPTool } from '../mcp-server/src/interfaces';
import { ZodRawShape } from 'zod';
import { CallToolResult, McpError, ReadResourceResult, ServerNotification, ServerRequest } from '@modelcontextprotocol/sdk/types.js';
import { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import { createOAuthServer, createOAuthMetadataServer } from '../mcp-server/src/oauth-server/index';
import { createAdminServer } from '../mcp-server/src/admin-server';
import { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';

// Extend Express Request type to include cookies
declare global {
  namespace Express {
    interface Request {
      cookies?: { [key: string]: string };
      auth: AuthInfo;
    }
  }
}

// Session management
interface MCPSession {
  id: string;
  transport: StreamableHTTPServerTransport;
  createdAt: Date;
  lastActivity: Date;
}

const sessions = new Map<string, MCPSession>();
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

// Global MCP server instance
let globalMcpServer: McpServer;

const MCP_CUSTOMIZED_ERROR_CODES = {
  AUTHENTICATION_REQUIRED: 401,
};

// Initialize global MCP server
function initializeGlobalMcpServer(): void {
  globalMcpServer = new McpServer({
    name: 'italki-mcp',
    version: '0.1.0',
    capabilities: {
      tools: {}
    }
  });

  // Register tools, resources, and prompts
  MCP_MODULES.forEach(module => {
    if (module.type === 'tool') {
      const mcpTool = module as MCPTool<ZodRawShape, ZodRawShape>;
      globalMcpServer.registerTool(mcpTool.name, mcpTool.config, async (args: unknown, extra: RequestHandlerExtra<ServerRequest, ServerNotification>): Promise<CallToolResult> => {
        if (mcpTool.needAuthInfo) {
          const authInfo = extra.authInfo;
          if (!authInfo || !authInfo.token) {
            throw new McpError(MCP_CUSTOMIZED_ERROR_CODES.AUTHENTICATION_REQUIRED, 'Authentication information is required. Check the info according to RFC 9728');
          }
        }
        try {
          const result = await mcpTool.toolCallback(args, extra);
          return result;
        }
        catch (e) {
          console.error(e);
          throw e;
        }
      });
    } else if (module.type === 'resource') {
      const mcpResource = module as MCPResource;
      globalMcpServer.registerResource(mcpResource.name, mcpResource.uriOrTemplate, mcpResource.config, async (url: URL): Promise<ReadResourceResult> => {
        try {
          return await mcpResource.readCallback(url, null);
        }
        catch (e) {
          console.error(e);
          throw e;
        }
      });
    } else if (module.type === 'prompt') {
      const mcpPrompt = module as MCPPrompt<ZodRawShape>;
      globalMcpServer.registerPrompt(mcpPrompt.name, mcpPrompt.config, mcpPrompt.promptCallback);
    }
  });
}

// Session management functions
function createMCPSession(): MCPSession {
  const sessionId = randomUUID();
  const now = new Date();
  
  // Create transport for this session
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => sessionId,
    enableJsonResponse: true,
  });

  // Connect global server to transport
  globalMcpServer.connect(transport);

  const session: MCPSession = {
    id: sessionId,
    transport,
    createdAt: now,
    lastActivity: now
  };

  sessions.set(sessionId, session);
  console.log(`Created new MCP session: ${sessionId}`);
  
  return session;
}

function getSession(sessionId: string): MCPSession | undefined {
  const session = sessions.get(sessionId);
  if (session) {
    session.lastActivity = new Date();
  }
  return session;
}

function cleanupExpiredSessions(): void {
  const now = new Date();
  const expiredSessions: string[] = [];
  
  for (const [sessionId, session] of sessions.entries()) {
    if (now.getTime() - session.lastActivity.getTime() > SESSION_TIMEOUT) {
      expiredSessions.push(sessionId);
    }
  }
  
  expiredSessions.forEach(sessionId => {
    sessions.delete(sessionId);
    console.log(`Cleaned up expired MCP session: ${sessionId}`);
  });
}

const MOCK_OAUTH_PROVIDER = process.env.MOCK_OAUTH_PROVIDER === 'true';

// 创建 Express 应用（不启动服务器）
export async function createApp(): Promise<express.Application> {
  // Initialize global MCP server
  initializeGlobalMcpServer();
  
  // Start session cleanup timer
  setInterval(cleanupExpiredSessions, 20 * 60 * 1000); // Clean up every 20 minutes

  const app = express();
  const LOG_FORMAT = process.env.LOG_FORMAT || 'common';
  const ENABLE_ACCESS_LOG = process.env.DISABLE_ACCESS_LOG !== 'true';
  const LOG_REQUEST_RESPONSE = process.env.LOG_REQUEST_RESPONSE === 'true';

  // Middleware
  app.use(express.json());
  app.use(express.text());
  app.use(express.urlencoded({ extended: true }));
  
  // Serve static files (icons) for templates
  // In production (Vercel), serve from dist/mcp-server/public
  // In development, serve from project root public
  // Try multiple paths to find public/icons directory
  const possibleIconPaths = [
    path.join(process.cwd(), 'dist', 'mcp-server', 'public', 'icons'),
    path.join(process.cwd(), 'public', 'icons'),
  ];
  
  // If __dirname is available (not in ESM), try relative paths
  try {
    // @ts-ignore - __dirname may not be available in ESM
    if (typeof __dirname !== 'undefined') {
      // @ts-ignore
      possibleIconPaths.push(
        path.join(__dirname, '..', 'public', 'icons'),
        path.join(__dirname, '..', '..', 'public', 'icons')
      );
    }
  } catch (e) {
    // __dirname not available, skip
  }
  
  let iconsPath: string | null = null;
  for (const iconPath of possibleIconPaths) {
    if (fs.existsSync(iconPath)) {
      iconsPath = iconPath;
      break;
    }
  }
  
  if (iconsPath) {
    app.use('/public/icons', express.static(iconsPath, {
      maxAge: '1y', // Cache icons for 1 year
      immutable: true
    }));
    console.log(`Static icons served from: ${iconsPath}`);
  } else {
    console.warn('Warning: Icons directory not found. Icons may not be available.');
    console.warn('Searched paths:', possibleIconPaths);
  }
  
  // Simple cookie parser middleware
  app.use((req, res, next) => {
    req.cookies = {};
    if (req.headers.cookie) {
      req.headers.cookie.split(';').forEach((cookie) => {
        const parts = cookie.trim().split('=');
        if (parts.length === 2) {
          req.cookies[parts[0]] = parts[1];
        }
      });
    }
    // Handle the authorization header and get the token
    const authorizationHeader = req.get('Authorization');
    if (authorizationHeader) {
      const token = authorizationHeader.split(' ')[1];
      req.auth = {
        token: token,
        clientId: '',
        scopes: []
      } as AuthInfo;
    }
    next();
  });

  // Access log middleware (简化版，适合 Vercel)
  if (ENABLE_ACCESS_LOG) {
    app.use((req, res, next) => {
      const start = Date.now();
      const timestamp = new Date().toISOString();
      
      const originalEnd = res.end.bind(res);
      res.end = function(chunk?: any, encoding?: any, cb?: any) {
        const duration = Date.now() - start;
        
        if (LOG_FORMAT === 'json') {
          console.log(JSON.stringify({
            level: 'info',
            type: 'access',
            timestamp,
            method: req.method,
            url: req.originalUrl || req.url,
            statusCode: res.statusCode,
            duration: `${duration}ms`,
            ip: req.ip || req.connection.remoteAddress || '-',
          }));
        } else {
          console.log(`${req.ip || '-'} - - [${timestamp}] "${req.method} ${req.originalUrl || req.url}" ${res.statusCode} ${duration}ms`);
        }
        
        return originalEnd(chunk, encoding, cb);
      };
      
      next();
    });
  }

  // Initialize OAuth Server if enabled
  let oauthServer: { router: express.RequestHandler; metadata: any; provider: any; validateAccessToken: (token: string) => Promise<any>; startCleanup: (intervalMs: number) => () => void } | null = null;
  
  // Vercel 环境下使用 /tmp 目录存储数据库（唯一可写目录）
  const dbPath = process.env.OAUTH_DB_PATH || (process.env.VERCEL ? '/tmp/db' : './db');
  
  if (MOCK_OAUTH_PROVIDER) {
    try {
      const baseUrl = process.env.VERCEL_URL 
        ? `https://${process.env.VERCEL_URL}` 
        : process.env.BASE_URL || 'https://learnabc.italki.com';
      
      oauthServer = createOAuthServer({
        accessTokenLifetime: Number(process.env.OAUTH_ACCESS_TOKEN_LIFETIME) || 3600,
        refreshTokenLifetime: Number(process.env.OAUTH_REFRESH_TOKEN_LIFETIME) || 86400,
        authorizationCodeLifetime: Number(process.env.OAUTH_AUTHORIZATION_CODE_LIFETIME) || 600,
        allowedScopes: (process.env.OAUTH_ALLOWED_SCOPES || 'read,write,admin').split(','),
        defaultScopes: (process.env.OAUTH_DEFAULT_SCOPES || 'read').split(','),
        dbPath: dbPath,
        issuerUrl: new URL(baseUrl),
        baseUrl: new URL(baseUrl),
        resourceServerUrl: new URL('mcp', baseUrl),
        scopesSupported: (process.env.OAUTH_ALLOWED_SCOPES || 'read,write,admin').split(','),
        resourceName: process.env.OAUTH_ISSUER || 'italki MCP Server',
      });

      // Add custom authentication routes
      app.post('/oauth/login', async (req, res) => {
        if (oauthServer?.provider) {
          await oauthServer.provider.handleLogin(req, res);
        } else {
          res.status(503).json({ error: 'OAuth server not available' });
        }
      });

      app.post('/oauth/register', async (req, res) => {
        if (oauthServer?.provider) {
          await oauthServer.provider.handleRegister(req, res);
        } else {
          res.status(503).json({ error: 'OAuth server not available' });
        }
      });

      app.post('/oauth/authorize', async (req, res) => {
        if (oauthServer?.provider) {
          await oauthServer.provider.handleAuthorizationConfirmation(req, res);
        } else {
          res.status(503).json({ error: 'OAuth server not available' });
        }
      });

      // Register OAuth router
      app.use(oauthServer.router);

      // Start OAuth cleanup task
      const cleanupInterval = Number(process.env.OAUTH_CLEANUP_INTERVAL) || 60 * 60 * 1000;
      oauthServer.startCleanup(cleanupInterval);

      console.log('OAuth Server initialized and endpoints registered');
      
      // 集成管理服务器路由到主应用（Vercel 不支持多端口）
      if (oauthServer.provider) {
        const adminApp = createAdminServer({
          oauthProvider: oauthServer.provider,
        });
        // 将管理 API 路由挂载到 /admin 路径下
        app.use('/admin', adminApp);
        console.log('Admin server routes integrated at /admin');
      }
    } catch (error) {
      console.error('Failed to initialize OAuth Server:', error);
      console.log('Continuing without OAuth support...');
    }
  } else {
    // External OAuth server
    try {
      const baseUrl = process.env.VERCEL_URL 
        ? `https://${process.env.VERCEL_URL}` 
        : process.env.BASE_URL || 'https://learnabc.italki.com';
      const externalOAuthServerUrl = process.env.EXTERNAL_OAUTH_SERVER_URL || 'https://api.italki.com';
      
      const metadataServer = createOAuthMetadataServer({
        issuerUrl: new URL(externalOAuthServerUrl),
        resourceServerUrl: new URL('mcp', baseUrl),
        scopesSupported: (process.env.OAUTH_ALLOWED_SCOPES || 'read,write,admin').split(','),
        resourceName: process.env.OAUTH_ISSUER || 'italki MCP Server',
      });

      app.use(metadataServer.router);

      console.log('OAuth Metadata Server initialized (using external OAuth server)');
    } catch (error) {
      console.error('Failed to initialize OAuth Metadata Server:', error);
      console.log('Continuing without OAuth metadata support...');
    }
  }

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.status(200).send('ok');
  });

  // MCP endpoint
  app.all('/mcp', async (req, res) => {
    try {
      const sessionId = req.get('Mcp-Session-Id');
      
      if (!sessionId) {
        const session = createMCPSession();
        res.set('Mcp-Session-Id', session.id);
        await session.transport.handleRequest(req as any, res as any, req.body);
        return;
      }
      
      const session = getSession(sessionId);
      if (!session) {
        console.error(`Session not found: ${sessionId}`);
        res.status(400).json({
          jsonrpc: '2.0',
          id: req.body?.id || null,
          error: {
            code: -32000,
            message: 'Session not found'
          }
        });
        return;
      }
      
      await session.transport.handleRequest(req as any, res as any, req.body);
      
    } catch (error) {
      console.error('MCP request handling error:', error);
      res.status(500).json({
        jsonrpc: '2.0',
        id: req.body?.id || null,
        error: {
          code: -32603,
          message: 'Internal error'
        }
      });
    }
  });

  return app;
}

// Vercel 函数导出
let appInstance: express.Application | null = null;

export default async function handler(req: any, res: any) {
  if (!appInstance) {
    appInstance = await createApp();
  }
  return appInstance(req, res);
}

