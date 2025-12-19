// Load environment variables from .env file (for local development)
import 'dotenv/config';

import express from 'express';
import https from 'https';
import fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

import { MCP_MODULES } from './mcp-modules';
import { MCPPrompt, MCPResource, MCPTool } from './interfaces';
import { ZodRawShape } from 'zod';
import { CallToolResult, McpError, ReadResourceResult, ServerNotification, ServerRequest } from '@modelcontextprotocol/sdk/types.js';
import { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import { createOAuthServer, createOAuthMetadataServer } from './oauth-server/index';
import { startAdminServer } from './admin-server';
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

function getSSLOptions(): https.ServerOptions {
  const certPath = process.env.SSL_CERT_PATH || './certs/server.crt';
  const keyPath = process.env.SSL_KEY_PATH || './certs/server.key';
  
  try {
    return {
      cert: fs.readFileSync(certPath),
      key: fs.readFileSync(keyPath),
    };
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('SSL certificate files not found:', error);
    throw new Error(`SSL certificate files not found. Please ensure ${certPath} and ${keyPath} exist.`);
  }
}

const MOCK_OAUTH_PROVIDER = process.env.MOCK_OAUTH_PROVIDER === 'true';

async function startMcpServer() {
  // Initialize global MCP server
  initializeGlobalMcpServer();
  
  // Start session cleanup timer
  setInterval(cleanupExpiredSessions, 20 * 60 * 1000); // Clean up every 20 minutes

  const app = express();
  const PORT = Number(process.env.PORT ?? 3030);
  const USE_HTTPS = process.env.USE_HTTPS === 'true';
  const HTTPS_PORT = Number(process.env.HTTPS_PORT ?? 3443);
  const LOG_FORMAT = process.env.LOG_FORMAT || 'common'; // 'common' or 'json'
  const ENABLE_ACCESS_LOG = process.env.DISABLE_ACCESS_LOG !== 'true';
  const LOG_REQUEST_RESPONSE = process.env.LOG_REQUEST_RESPONSE === 'true';

  // Middleware
  app.use(express.json());
  app.use(express.text());
  app.use(express.urlencoded({ extended: true })); // For OAuth form submissions
  
  // Serve static files (icons) for templates
  // Try multiple paths to find public/icons directory
  const possibleIconPaths = [
    path.join(process.cwd(), 'public', 'icons'),
    path.join(process.cwd(), '..', 'public', 'icons'),
    path.join(__dirname, '..', '..', 'public', 'icons'),
  ];
  
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
    console.log(`Static icons served from: ${iconsPath} at /public/icons`);
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

  // Access log middleware
  if (ENABLE_ACCESS_LOG) {
    app.use((req, res, next) => {
      const start = Date.now();
      const timestamp = new Date().toISOString();
      
      // Extract sessionId from cookie or query parameter
      const sessionId = req.cookies?.sessionId || 
                       req.headers.cookie?.match(/sessionId=([^;]+)/)?.[1] || 
                       (req.query?.sessionId as string) || 
                       '-';
      
      // Capture request body for logging
      const requestBody = req.body ? JSON.stringify(req.body) : '-';
      
      // Override res.end to capture response details
      const originalEnd = res.end.bind(res);
      res.end = function(chunk?: any, encoding?: any, cb?: any) {
        const duration = Date.now() - start;
        
        // Capture response body
        let responseBody = '-';
        if (chunk) {
          try {
            // Try to parse as JSON for better formatting
            const parsed = JSON.parse(chunk.toString());
            responseBody = JSON.stringify(parsed);
          } catch {
            // If not JSON, use as string (truncate if too long)
            responseBody = chunk.toString();
            if (responseBody.length > 1000) {
              responseBody = responseBody.substring(0, 1000) + '... (truncated)';
            }
          }
        }
        
        // Capture MCP-related headers
        const mcpHeaders = {
          mcpSessionId: req.get('Mcp-Session-Id') || '-',
          mcpVersion: req.get('Mcp-Version') || '-',
          mcpClientInfo: req.get('Mcp-Client-Info') || '-',
          contentType: req.get('Content-Type') || '-',
          accept: req.get('Accept') || '-'
        };

        // Capture OAuth-related headers
        const oauthHeaders = {
          authorization: req.get('Authorization') || '-',
          clientId: req.get('X-Client-Id') || '-',
          clientSecret: req.get('X-Client-Secret') ? '[REDACTED]' : '-',
          grantType: req.get('X-Grant-Type') || '-',
          responseType: req.get('X-Response-Type') || '-',
          redirectUri: req.get('X-Redirect-Uri') || '-',
          scope: req.get('X-Scope') || '-',
          state: req.get('X-State') || '-',
          codeChallenge: req.get('X-Code-Challenge') || '-',
          codeChallengeMethod: req.get('X-Code-Challenge-Method') || '-',
          accessToken: req.get('X-Access-Token') ? '[REDACTED]' : '-',
          refreshToken: req.get('X-Refresh-Token') ? '[REDACTED]' : '-',
          tokenType: req.get('X-Token-Type') || '-',
          expiresIn: req.get('X-Expires-In') || '-',
          clientName: req.get('X-Client-Name') || '-',
          clientUri: req.get('X-Client-Uri') || '-',
          logoUri: req.get('X-Logo-Uri') || '-',
          tosUri: req.get('X-Tos-Uri') || '-',
          policyUri: req.get('X-Policy-Uri') || '-',
          contacts: req.get('X-Contacts') || '-',
          applicationType: req.get('X-Application-Type') || '-',
          tokenEndpointAuthMethod: req.get('X-Token-Endpoint-Auth-Method') || '-'
        };

        const logData = {
          timestamp,
          method: req.method,
          url: req.originalUrl || req.url,
          statusCode: res.statusCode,
          duration: `${duration}ms`,
          sessionId: sessionId,
          userAgent: req.get('User-Agent') || '-',
          ip: req.ip || req.connection.remoteAddress || '-',
          contentLength: res.get('Content-Length') || '-',
          referer: req.get('Referer') || '-',
          protocol: req.protocol,
          host: req.get('Host') || '-',
          ...(LOG_REQUEST_RESPONSE && {
            requestBody: requestBody,
            responseBody: responseBody.length > 500 ? responseBody.substring(0, 1500) + '... (truncated)' : responseBody,
            mcpHeaders,
            oauthHeaders
          })
        };
        
        if (LOG_FORMAT === 'json') {
          // JSON format log
          console.log(JSON.stringify({
            level: 'info',
            type: 'access',
            ...logData
          }));
        } else {
          // Common Log Format (with sessionId)
          console.log(`${logData.ip} - - [${logData.timestamp}] "${logData.method} ${logData.url}" ${logData.statusCode} ${logData.contentLength} "${logData.userAgent}" ${logData.duration} [sessionId:${logData.sessionId}]`);
          
          // Add request/response bodies and headers if enabled
          if (LOG_REQUEST_RESPONSE) {
            if (logData.requestBody && logData.requestBody !== '-') {
              console.log(`  Request: ${logData.requestBody}`);
            }
            if (logData.responseBody && logData.responseBody !== '-') {
              console.log(`  Response: ${logData.responseBody}`);
            }
            
            // MCP Headers
            if (logData.mcpHeaders) {
              const mcpInfo = [];
              if (logData.mcpHeaders.mcpSessionId !== '-') mcpInfo.push(`Session: ${logData.mcpHeaders.mcpSessionId}`);
              if (logData.mcpHeaders.mcpVersion !== '-') mcpInfo.push(`Version: ${logData.mcpHeaders.mcpVersion}`);
              if (logData.mcpHeaders.mcpClientInfo !== '-') mcpInfo.push(`Client: ${logData.mcpHeaders.mcpClientInfo}`);
              if (mcpInfo.length > 0) {
                console.log(`  MCP Headers: ${mcpInfo.join(', ')}`);
              }
            }
            
            // OAuth Headers
            if (logData.oauthHeaders) {
              const oauthInfo = [];
              if (logData.oauthHeaders.authorization !== '-') oauthInfo.push(`Auth: ${logData.oauthHeaders.authorization}`);
              if (logData.oauthHeaders.clientId !== '-') oauthInfo.push(`ClientId: ${logData.oauthHeaders.clientId}`);
              if (logData.oauthHeaders.grantType !== '-') oauthInfo.push(`GrantType: ${logData.oauthHeaders.grantType}`);
              if (logData.oauthHeaders.responseType !== '-') oauthInfo.push(`ResponseType: ${logData.oauthHeaders.responseType}`);
              if (logData.oauthHeaders.scope !== '-') oauthInfo.push(`Scope: ${logData.oauthHeaders.scope}`);
              if (logData.oauthHeaders.state !== '-') oauthInfo.push(`State: ${logData.oauthHeaders.state}`);
              if (logData.oauthHeaders.redirectUri !== '-') oauthInfo.push(`RedirectUri: ${logData.oauthHeaders.redirectUri}`);
              if (logData.oauthHeaders.clientName !== '-') oauthInfo.push(`ClientName: ${logData.oauthHeaders.clientName}`);
              if (logData.oauthHeaders.tokenType !== '-') oauthInfo.push(`TokenType: ${logData.oauthHeaders.tokenType}`);
              if (logData.oauthHeaders.expiresIn !== '-') oauthInfo.push(`ExpiresIn: ${logData.oauthHeaders.expiresIn}`);
              if (logData.oauthHeaders.applicationType !== '-') oauthInfo.push(`AppType: ${logData.oauthHeaders.applicationType}`);
              if (logData.oauthHeaders.tokenEndpointAuthMethod !== '-') oauthInfo.push(`AuthMethod: ${logData.oauthHeaders.tokenEndpointAuthMethod}`);
              if (oauthInfo.length > 0) {
                console.log(`  OAuth Headers: ${oauthInfo.join(', ')}`);
              }
            }
          }
        }
        
        // Call original end method
        return originalEnd(chunk, encoding, cb);
      };
      
      next();
    });
  }

  // Initialize OAuth Server if enabled
  let oauthServer: { router: express.RequestHandler; metadata: any; provider: any; validateAccessToken: (token: string) => Promise<any>; startCleanup: (intervalMs: number) => () => void } | null = null;
  if (MOCK_OAUTH_PROVIDER) {
    try {
      const baseUrl = 'https://learnabc.italki.com';
      oauthServer = createOAuthServer({
        accessTokenLifetime: 3600,
        refreshTokenLifetime: 86400,
        authorizationCodeLifetime: 600,
        allowedScopes: 'read,write,admin'.split(','),
        defaultScopes: 'read'.split(','),
        dbPath: process.env.OAUTH_DB_PATH || './db',
        issuerUrl: new URL(baseUrl),
        baseUrl: new URL(baseUrl),
        resourceServerUrl: new URL('mcp', baseUrl),
        scopesSupported: 'read,write,admin'.split(','),
        resourceName: 'italki MCP Server',
      });

      // Add custom authentication routes BEFORE the SDK router
      // These routes handle login, registration
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

      // Register OAuth router at root level (after our custom routes)
      // The SDK router expects to be mounted at root, and it only handles specific OAuth paths
      // (e.g., /authorize, /token, /register, /revoke for OAuth endpoints;
      // /.well-known/oauth-authorization-server, /.well-known/oauth-protected-resource for metadata endpoints)
      // so it won't interfere with other routes like /mcp
      app.use(oauthServer.router);

      // Start OAuth cleanup task
      const cleanupInterval = Number(process.env.OAUTH_CLEANUP_INTERVAL) || 60 * 60 * 1000; // 1 hour default
      oauthServer.startCleanup(cleanupInterval);

      console.log('OAuth Server initialized and endpoints registered');
    } catch (error) {
      console.error('Failed to initialize OAuth Server:', error);
      console.log('Continuing without OAuth support...');
    }


  } else {
    // This means we are using an external OAuth server
    try {
      const baseUrl = 'https://learnabc.italki.com';
      const externalOAuthServerUrl = 'https://api.italki.com';
      const metadataServer = createOAuthMetadataServer({
        issuerUrl: new URL(externalOAuthServerUrl),
        resourceServerUrl: new URL('mcp', baseUrl),
        scopesSupported: 'read,write,admin'.split(','),
        resourceName: 'italki MCP Server',
      });

      // Register OAuth metadata router at root level
      // This only provides the protected resource metadata endpoint
      // (/.well-known/oauth-protected-resource)
      app.use(metadataServer.router);

      console.log('OAuth Metadata Server initialized (using external OAuth server)');
      console.log('OAuth metadata endpoint available at /.well-known/oauth-protected-resource');
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
      // console.log("====== Incoming Request ======");
      // console.log("Headers:", req.headers);
      // console.log("Body:", req.body);
      // console.log("==============================");

      // Get session ID from headers
      const sessionId = req.get('Mcp-Session-Id');
      
      if (!sessionId) {
        // No session ID provided, create a new session
        const session = createMCPSession();
        res.set('Mcp-Session-Id', session.id);
        await session.transport.handleRequest(req as any, res as any, req.body);
        return;
      }
      
      // Find existing session, or create a new one if not found
      let session = getSession(sessionId);
      if (!session) {
        // Session not found - this can happen if:
        // 1. Session expired (30min timeout)
        // 2. Server restarted (sessions stored in memory)
        // 3. Invalid session ID provided
        // 
        // Security consideration: We create a new session instead of rejecting.
        // This is safe because:
        // - Session only stores transport state, not auth credentials
        // - Authentication is handled separately via Authorization header
        // - New session ID is server-generated (UUID), not client-provided
        // - Session will be cleaned up after 30min of inactivity
        console.log(`Session not found: ${sessionId}, creating new session (session may have expired or server restarted)`);
        session = createMCPSession();
        res.set('Mcp-Session-Id', session.id);
      }
      
      // Handle request with session
      await session.transport.handleRequest(req as any, res as any, req.body);
      
    } catch (error) {
      // eslint-disable-next-line no-console
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

  // Start HTTP/HTTPS server
  if (USE_HTTPS) {
    const httpsOptions = getSSLOptions();
    https.createServer(httpsOptions, app).listen(HTTPS_PORT, () => {
      // eslint-disable-next-line no-console
      console.log(`MCP HTTPS server listening on https://localhost:${HTTPS_PORT}`);
      if (MOCK_OAUTH_PROVIDER) {
        if (oauthServer) {
          console.log('Mock OAuth Server is enabled and running');
          console.log('Mock OAuth endpoints available at /oauth/*');
          console.log('  - GET  /oauth/authorize (Authorization endpoint)');
          console.log('  - POST /oauth/token (Token endpoint)');
          console.log('  - POST /oauth/register (Client registration)');
          console.log('  - GET  /oauth/.well-known/oauth-authorization-server (Server info)');
        } else {
          console.log('Mock OAuth Server is enabled but not running');
        }
      }
    });
  } else {
    app.listen(PORT, () => {
      // eslint-disable-next-line no-console
      console.log(`MCP HTTP server listening on http://localhost:${PORT}`);
      if (MOCK_OAUTH_PROVIDER) {
        if (oauthServer) {
          console.log('Mock OAuth Server is enabled and running');
          console.log('Mock OAuth endpoints available at /oauth/*');
          console.log('  - GET  /oauth/authorize (Authorization endpoint)');
          console.log('  - POST /oauth/token (Token endpoint)');
          console.log('  - POST /oauth/register (Client registration)');
          console.log('  - GET  /oauth/.well-known/oauth-authorization-server (Server info)');
        } else {
          console.log('Mock OAuth Server is enabled but not running');
        }
      }
    });
  }


  // Start admin server if OAuth is enabled
  if (MOCK_OAUTH_PROVIDER) {
    if (oauthServer?.provider) {
      const ADMIN_PORT = Number(process.env.ADMIN_PORT) || 3031;
      await startAdminServer({
        port: ADMIN_PORT,
        oauthProvider: oauthServer.provider,
      });
    } else {
      console.log('Admin server is enabled but not running');
    }
  }
}

(async () => {
  try {
    // Start MCP server
    await startMcpServer();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to start servers:', error);
    process.exit(1);
  }
})();
