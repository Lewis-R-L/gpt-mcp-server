import { RequestHandler, Router } from 'express';
import { mcpAuthRouter, createOAuthMetadata } from '@modelcontextprotocol/sdk/server/auth/router.js';
import { OAuthMetadata, OAuthProtectedResourceMetadata } from '@modelcontextprotocol/sdk/shared/auth.js';
import { metadataHandler } from '@modelcontextprotocol/sdk/server/auth/handlers/metadata.js';
import { NeDBOAuthServerProvider, OAuthServerConfig } from './provider';

export interface OAuthServerOptions {
  accessTokenLifetime?: number;
  refreshTokenLifetime?: number;
  authorizationCodeLifetime?: number;
  allowedScopes?: string[];
  defaultScopes?: string[];
  dbPath?: string;
  issuerUrl: URL;
  baseUrl?: URL;
  resourceServerUrl?: URL;
  scopesSupported?: string[];
  resourceName?: string;
}

interface OAuthServer {
  router: RequestHandler;
  metadata: OAuthMetadata;
  provider: NeDBOAuthServerProvider;
  validateAccessToken: (token: string) => Promise<{ clientId: string; scopes: string[]; expiresAt?: number } | null>;
  startCleanup: (intervalMs: number) => () => void;
}

/**
 * Creates an OAuth server with router and utility functions.
 * The router should be mounted at /oauth.
 */
export function createOAuthServer(options: OAuthServerOptions): OAuthServer {
  const config: OAuthServerConfig = {
    accessTokenLifetime: options.accessTokenLifetime || 3600,
    refreshTokenLifetime: options.refreshTokenLifetime || 86400,
    authorizationCodeLifetime: options.authorizationCodeLifetime || 600,
    allowedScopes: options.allowedScopes || ['read', 'write', 'admin'],
    defaultScopes: options.defaultScopes || ['read'],
    dbPath: options.dbPath || './db',
  };

  const issuerUrl = options.issuerUrl;
  const baseUrl = options.baseUrl || issuerUrl;
  const resourceServerUrl = options.resourceServerUrl || baseUrl;
  const scopesSupported = options.scopesSupported || config.allowedScopes;

  // Create a single provider instance shared by router and utilities
  const provider = new NeDBOAuthServerProvider(config);

  // Create OAuth metadata
  const metadata = createOAuthMetadata({
    provider,
    issuerUrl,
    baseUrl,
    scopesSupported,
  });

  // Create the SDK router
  // Note: The SDK router expects to be mounted at the application root according to docs.
  // When resourceServerUrl is provided, it will automatically register the protected resource
  // metadata endpoint at /.well-known/oauth-protected-resource
  const router = mcpAuthRouter({
    provider,
    issuerUrl,
    baseUrl,
    resourceServerUrl,
    scopesSupported,
    resourceName: options.resourceName,
  });

  // Validate access token helper
  const validateAccessToken = async (
    token: string
  ): Promise<{ clientId: string; scopes: string[]; expiresAt?: number } | null> => {
    try {
      const authInfo = await provider.verifyAccessToken(token);
      return {
        clientId: authInfo.clientId,
        scopes: authInfo.scopes,
        expiresAt: authInfo.expiresAt,
      };
    } catch {
      return null;
    }
  };

  // Start cleanup task
  const startCleanup = (intervalMs: number): (() => void) => {
    const interval = setInterval(async () => {
      try {
        await provider.cleanup();
        console.log('OAuth cleanup completed');
      } catch (error) {
        console.error('OAuth cleanup error:', error);
      }
    }, intervalMs);

    return () => clearInterval(interval);
  };

  return {
    router,
    metadata,
    provider,
    validateAccessToken,
    startCleanup,
  };
}

export interface OAuthMetadataServerOptions {
  issuerUrl: URL;
  resourceServerUrl?: URL;
  scopesSupported?: string[];
  resourceName?: string;
}

interface OAuthMetadataServer {
  router: RequestHandler;
  metadata: OAuthMetadata;
}

function validateIssuerUrl(issuer: URL): void {
  // Technically RFC 8414 does not permit a localhost HTTPS exemption, but this will be necessary for ease of testing
  if (issuer.protocol !== 'https:' && issuer.hostname !== 'localhost' && issuer.hostname !== '127.0.0.1') {
      throw new Error('Issuer URL must be HTTPS');
  }
  if (issuer.hash) {
      throw new Error(`Issuer URL must not have a fragment: ${issuer}`);
  }
  if (issuer.search) {
      throw new Error(`Issuer URL must not have a query string: ${issuer}`);
  }
}

/**
 * Creates an OAuth metadata server that only provides metadata endpoints.
 * This is used when using an external OAuth server.
 * The router should be mounted at root level.
 */
export function createOAuthMetadataServer(options: OAuthMetadataServerOptions): OAuthMetadataServer {
  validateIssuerUrl(options.issuerUrl);

  const router = Router();

  // Create metadata for the protected resource (for return value)
  const metadata: OAuthProtectedResourceMetadata = {
    resource: options.resourceServerUrl?.href,
    authorization_servers: [options.issuerUrl.href],

    scopes_supported: options.scopesSupported,
    resource_name: options.resourceName
  };

  // Serve PRM at the path-specific URL per RFC 9728
  const rsPath = options.resourceServerUrl?.pathname || '';
  router.use(`/.well-known/oauth-protected-resource${rsPath === '/' ? '' : rsPath}`, metadataHandler(metadata));

  return {
    router,
    metadata,
  };
}
