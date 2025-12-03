import { randomUUID } from 'node:crypto';
import { Response, Request } from 'express';
import {
  OAuthServerProvider,
  AuthorizationParams,
} from '@modelcontextprotocol/sdk/server/auth/provider.js';
import { OAuthClientInformationFull, OAuthTokens } from '@modelcontextprotocol/sdk/shared/auth.js';
import { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import { InvalidRequestError } from '@modelcontextprotocol/sdk/server/auth/errors.js';
import { NeDBClientsStore } from './clients-store.js';
import { NeDBUsersStore } from './users-store.js';
import { NeDBAuthorizationCodesStore, AuthorizationCodeData } from './authorization-codes-store.js';
import { NeDBTokensStore, TokenData } from './tokens-store.js';
import { NeDBPendingAuthorizationsStore, PendingAuthorizationData, StoredAuthorizationParams } from './pending-authorizations-store.js';
import { NeDBUserSessionsStore } from './user-sessions-store.js';
import { getLoginPage, getAuthorizationPage } from './auth-pages.js';

export interface OAuthServerConfig {
  accessTokenLifetime: number; // in seconds
  refreshTokenLifetime: number; // in seconds
  authorizationCodeLifetime: number; // in seconds
  allowedScopes: string[];
  defaultScopes: string[];
  dbPath: string;
}

export class NeDBOAuthServerProvider implements OAuthServerProvider {
  readonly clientsStore: NeDBClientsStore;
  readonly usersStore: NeDBUsersStore;
  readonly codesStore: NeDBAuthorizationCodesStore;
  readonly tokensStore: NeDBTokensStore;
  readonly pendingAuthorizationsStore: NeDBPendingAuthorizationsStore;
  readonly userSessionsStore: NeDBUserSessionsStore;
  private config: OAuthServerConfig;
  private readonly SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

  constructor(config: OAuthServerConfig) {
    this.config = config;

    // Initialize all stores (each store will ensure its database directory exists)
    this.clientsStore = new NeDBClientsStore(config.dbPath, config.allowedScopes);
    this.usersStore = new NeDBUsersStore(config.dbPath);
    this.codesStore = new NeDBAuthorizationCodesStore(config.dbPath);
    this.tokensStore = new NeDBTokensStore(config.dbPath);
    this.pendingAuthorizationsStore = new NeDBPendingAuthorizationsStore(config.dbPath);
    this.userSessionsStore = new NeDBUserSessionsStore(config.dbPath);

    // Cleanup expired sessions and pending authorizations periodically
    setInterval(async () => {
      try {
        await this.cleanupSessions();
      } catch (error) {
        console.error('Error cleaning up sessions:', error);
      }
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  // Get session ID from request (from cookie or query param)
  private getSessionId(req: Request): string {
    // Try to get from cookie first
    const cookieSessionId = req.cookies?.sessionId || req.headers.cookie?.match(/sessionId=([^;]+)/)?.[1];
    if (cookieSessionId) {
      return cookieSessionId;
    }
    
    // Try query parameter
    const querySessionId = req.query?.sessionId as string;
    if (querySessionId) {
      return querySessionId;
    }
    
    // Generate new session ID
    return randomUUID();
  }

  // Set session cookie
  private setSessionCookie(res: Response, sessionId: string): void {
    res.cookie('sessionId', sessionId, {
      httpOnly: true,
      secure: process.env.USE_HTTPS === 'true',
      sameSite: 'lax',
      maxAge: 30 * 60 * 1000, // 30 minutes
    });
  }

  // Check if user is logged in
  private async isUserLoggedIn(sessionId: string): Promise<boolean> {
    const session = await this.userSessionsStore.getSession(sessionId);
    if (!session) {
      return false;
    }
    // Check if session is expired (30 minutes)
    const now = Date.now();
    if (now - session.createdAt > this.SESSION_TIMEOUT) {
      await this.userSessionsStore.deleteSession(sessionId);
      return false;
    }
    return true;
  }

  // Get username from session
  private async getUsernameFromSession(sessionId: string): Promise<string | null> {
    const session = await this.userSessionsStore.getSession(sessionId);
    if (!session) {
      return null;
    }
    // Check if session is expired
    const now = Date.now();
    if (now - session.createdAt > this.SESSION_TIMEOUT) {
      await this.userSessionsStore.deleteSession(sessionId);
      return null;
    }
    return session.username;
  }

  async authorize(
    client: OAuthClientInformationFull,
    params: AuthorizationParams,
    res: Response
  ): Promise<void> {
    try {
      // Note: redirect_uri and scope validation are already done by the SDK's authorization handler
      // (checking redirect_uri is in client.redirect_uris and scopes are in client.scope)
      const req = res.req as Request;
      if (!req) {
        throw new Error('Request object not found in response');
      }
      
      // Filter scopes to only include allowed scopes (additional server-level filtering)
      const requestedScopes = params.scopes || this.config.defaultScopes;
      const validScopes = requestedScopes.filter((scope) =>
        this.config.allowedScopes.includes(scope)
      );

      if (validScopes.length === 0) {
        throw new InvalidRequestError('Invalid scope: "' + requestedScopes.join(', ') + '" not in allowed scopes: "' + this.config.allowedScopes.join(', ') + '"');
      }

      // Get or create session ID
      const sessionId = this.getSessionId(req);
      
      // Check if user is logged in
      if (!(await this.isUserLoggedIn(sessionId))) {
        // User is not logged in, store pending authorization and show login page
        
        const now = Date.now();
        const expiresAt = now + this.config.authorizationCodeLifetime * 1000;
        
        // Convert AuthorizationParams to StoredAuthorizationParams (resource: URL -> string)
        const storedParams: StoredAuthorizationParams = {
          redirectUri: params.redirectUri,
          scopes: params.scopes,
          resource: params.resource?.toString(),
          state: params.state,
          codeChallenge: params.codeChallenge,
        };
        
        const pendingAuth: PendingAuthorizationData = {
          sessionId,
          client,
          params: storedParams,
          validScopes,
          createdAt: now,
          expiresAt,
        };
        
        // Check if there's already a pending authorization for this session
        const existingPendingAuth = await this.pendingAuthorizationsStore.getPendingAuthorization(sessionId);
        if (existingPendingAuth) {
          // If exists and not expired, update it with new authorization parameters
          if (existingPendingAuth.expiresAt > now) {
            await this.pendingAuthorizationsStore.updatePendingAuthorization(sessionId, {
              client,
              params: storedParams,
              validScopes,
              createdAt: now,
              expiresAt,
            });
          } else {
            // If expired, delete the old one and create a new one
            await this.pendingAuthorizationsStore.deletePendingAuthorization(sessionId);
            await this.pendingAuthorizationsStore.createPendingAuthorization(pendingAuth);
          }
        } else {
          // If doesn't exist, create a new one
          await this.pendingAuthorizationsStore.createPendingAuthorization(pendingAuth);
        }
        
        this.setSessionCookie(res, sessionId);
        
        // Show login page
        res.status(200).send(getLoginPage());
        return;
      }

      // User is logged in, show authorization page
      const username = await this.getUsernameFromSession(sessionId);
      if (!username) {
        // Session expired, show login page again
        res.status(200).send(getLoginPage('Session expired, please login again'));
        return;
      }

      // Store pending authorization for authorization confirmation
      const now = Date.now();
      const expiresAt = now + this.config.authorizationCodeLifetime * 1000;
      
      // Convert AuthorizationParams to StoredAuthorizationParams (resource: URL -> string)
      const storedParams: StoredAuthorizationParams = {
        redirectUri: params.redirectUri,
        scopes: params.scopes,
        resource: params.resource?.toString(),
        state: params.state,
        codeChallenge: params.codeChallenge,
      };
      
      const pendingAuth: PendingAuthorizationData = {
        sessionId,
        client,
        params: storedParams,
        validScopes,
        userId: username,
        createdAt: now,
        expiresAt,
      };
      
      // Check if there's already a pending authorization for this session
      const existingPendingAuth = await this.pendingAuthorizationsStore.getPendingAuthorization(sessionId);
      if (existingPendingAuth) {
        // If exists and not expired, update it with new authorization parameters
        if (existingPendingAuth.expiresAt > now) {
          await this.pendingAuthorizationsStore.updatePendingAuthorization(sessionId, {
            client,
            params: storedParams,
            validScopes,
            userId: username,
            createdAt: now,
            expiresAt,
          });
        } else {
          // If expired, delete the old one and create a new one
          await this.pendingAuthorizationsStore.deletePendingAuthorization(sessionId);
          await this.pendingAuthorizationsStore.createPendingAuthorization(pendingAuth);
        }
      } else {
        // If doesn't exist, create a new one
        await this.pendingAuthorizationsStore.createPendingAuthorization(pendingAuth);
      }
      
      this.setSessionCookie(res, sessionId);
      
      // Show authorization confirmation page
      const clientName = client.client_name || client.client_id;
      res.status(200).send(getAuthorizationPage(clientName, validScopes, params.redirectUri));
    } catch (error) {
      console.error('Authorization error:', error);
      throw error;
    }
  }

  // Handle login
  async handleLogin(req: Request, res: Response): Promise<void> {
    const { username, password } = req.body;
    
    if (!username || !password) {
      res.status(400).send(getLoginPage('Please provide username and password'));
      return;
    }

    try {
      const isValid = await this.usersStore.verifyPassword(username, password);
      if (!isValid) {
        res.status(401).send(getLoginPage('Username or password incorrect'));
        return;
      }

      // Create user session
      const sessionId = this.getSessionId(req) || randomUUID();
      await this.userSessionsStore.createSession(sessionId, username);
      
      this.setSessionCookie(res, sessionId);

      // Check if there's a pending authorization
      const pendingAuth = await this.pendingAuthorizationsStore.getPendingAuthorization(sessionId);
      if (pendingAuth) {
        // Update pending authorization with user ID
        await this.pendingAuthorizationsStore.updatePendingAuthorization(sessionId, {
          userId: username,
        });
        
        // Show authorization page
        const clientName = pendingAuth.client.client_name || pendingAuth.client.client_id;
        res.status(200).send(getAuthorizationPage(clientName, pendingAuth.validScopes, pendingAuth.params.redirectUri));
        return;
      }

      // No pending authorization, redirect to a success page or home
      res.status(200).send('<html><body><h1>Login successful</h1><p>You have successfully logged in.</p></body></html>');
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).send(getLoginPage('Login error'));
    }
  }

  // Handle registration
  async handleRegister(req: Request, res: Response): Promise<void> {
    const { username, password, passwordConfirm } = req.body;
    
    if (!username || !password) {
      res.status(400).send(getLoginPage('Please provide username and password'));
      return;
    }

    if (password !== passwordConfirm) {
      res.status(400).send(getLoginPage('Passwords do not match'));
      return;
    }

    try {
      await this.usersStore.createUser(username, password);

      // Create user session (registration success = login success)
      const sessionId = this.getSessionId(req) || randomUUID();
      await this.userSessionsStore.createSession(sessionId, username);
      
      this.setSessionCookie(res, sessionId);

      // Check if there's a pending authorization
      const pendingAuth = await this.pendingAuthorizationsStore.getPendingAuthorization(sessionId);
      if (pendingAuth) {
        // Update pending authorization with user ID
        await this.pendingAuthorizationsStore.updatePendingAuthorization(sessionId, {
          userId: username,
        });
        
        // Show authorization page
        const clientName = pendingAuth.client.client_name || pendingAuth.client.client_id;
        res.status(200).send(getAuthorizationPage(clientName, pendingAuth.validScopes, pendingAuth.params.redirectUri));
        return;
      }

      // No pending authorization, redirect to a success page
      res.status(200).send('<html><body><h1>Registration successful</h1><p>You have successfully registered and logged in.</p></body></html>');
    } catch (error: any) {
      console.error('Registration error:', error);
      const errorMessage = error.message === 'User already exists' ? 'Username already exists' : 'Registration error';
      res.status(400).send(getLoginPage(errorMessage));
    }
  }

  // Handle authorization confirmation
  async handleAuthorizationConfirmation(req: Request, res: Response): Promise<void> {
    const sessionId = this.getSessionId(req);
    const { action } = req.body;

    if (!sessionId) {
      res.status(400).send(getLoginPage('Invalid session'));
      return;
    }

    const pendingAuth = await this.pendingAuthorizationsStore.getPendingAuthorization(sessionId);
    if (!pendingAuth) {
      res.status(400).send(getLoginPage('Authorization request expired or does not exist'));
      return;
    }

    // Check if session is expired
    if (Date.now() > pendingAuth.expiresAt) {
      await this.pendingAuthorizationsStore.deletePendingAuthorization(sessionId);
      res.status(400).send(getLoginPage('Authorization request expired'));
      return;
    }

    // Check if user is logged in
    if (!(await this.isUserLoggedIn(sessionId))) {
      res.status(401).send(getLoginPage('Please login first'));
      return;
    }

    if (action === 'deny') {
      // User denied authorization
      await this.pendingAuthorizationsStore.deletePendingAuthorization(sessionId);
      const errorParams = new URLSearchParams({
        error: 'access_denied',
        error_description: 'User denied the authorization request',
      });
      if (pendingAuth.params.state) {
        errorParams.set('state', pendingAuth.params.state);
      }
      const targetUrl = new URL(pendingAuth.params.redirectUri);
      targetUrl.search = errorParams.toString();
      res.redirect(targetUrl.toString());
      return;
    }

    if (action !== 'approve') {
      res.status(400).send(getAuthorizationPage(
        pendingAuth.client.client_name || pendingAuth.client.client_id,
        pendingAuth.validScopes,
        pendingAuth.params.redirectUri,
        'Invalid action'
      ));
      return;
    }

    // User approved authorization, generate authorization code
    const code = randomUUID();
    const now = Date.now();
    const expiresAt = now + this.config.authorizationCodeLifetime * 1000;

    // Store authorization code
    const codeData: AuthorizationCodeData = {
      code,
      clientId: pendingAuth.client.client_id,
      codeChallenge: pendingAuth.params.codeChallenge || '',
      redirectUri: pendingAuth.params.redirectUri,
      scopes: pendingAuth.validScopes,
      resource: pendingAuth.params.resource, // Already a string
      expiresAt,
      createdAt: now,
    };

    await this.codesStore.createCode(codeData);

    // Remove pending authorization
    await this.pendingAuthorizationsStore.deletePendingAuthorization(sessionId);

    // Redirect to client's redirect URI with authorization code
    const searchParams = new URLSearchParams({
      code,
    });

    if (pendingAuth.params.state !== undefined) {
      searchParams.set('state', pendingAuth.params.state);
    }

    const targetUrl = new URL(pendingAuth.params.redirectUri);
    targetUrl.search = searchParams.toString();
    res.redirect(targetUrl.toString());
  }

  // Cleanup expired sessions
  private async cleanupSessions(): Promise<void> {
    // Cleanup expired user sessions and pending authorizations
    await Promise.all([
      this.userSessionsStore.cleanupExpired(this.SESSION_TIMEOUT),
      this.pendingAuthorizationsStore.cleanupExpired(),
    ]);
  }

  async challengeForAuthorizationCode(
    client: OAuthClientInformationFull,
    authorizationCode: string
  ): Promise<string> {
    // Note: Client authentication is already verified by SDK's authenticateClient middleware
    
    const codeData = await this.codesStore.getCode(authorizationCode);

    if (!codeData) {
      throw new InvalidRequestError('Invalid authorization code');
    }

    // Check expiration
    if (codeData.expiresAt < Date.now()) {
      throw new InvalidRequestError('Authorization code has expired');
    }

    // Verify that the authorization code belongs to this client
    // (prevents client A from using client B's authorization code)
    if (codeData.clientId !== client.client_id) {
      throw new InvalidRequestError(
        `Authorization code was not issued to this client, ${codeData.clientId} != ${client.client_id}`
      );
    }

    return codeData.codeChallenge;
  }

  async exchangeAuthorizationCode(
    client: OAuthClientInformationFull,
    authorizationCode: string,
    codeVerifier?: string,
    redirectUri?: string,
    resource?: URL
  ): Promise<OAuthTokens> {
    // Note: Client authentication and PKCE verification are already done by SDK's token handler
    
    const codeData = await this.codesStore.getCode(authorizationCode);

    if (!codeData) {
      throw new InvalidRequestError('Invalid authorization code');
    }

    // Check expiration
    if (codeData.expiresAt < Date.now()) {
      // Clean up expired code
      await this.codesStore.deleteCode(authorizationCode);
      throw new InvalidRequestError('Authorization code has expired');
    }

    // Verify that the authorization code belongs to this client
    // (prevents client A from using client B's authorization code)
    if (codeData.clientId !== client.client_id) {
      throw new InvalidRequestError(
        `Authorization code was not issued to this client, ${codeData.clientId} != ${client.client_id}`
      );
    }

    // Verify redirect URI if provided (SDK passes it but doesn't validate match)
    if (redirectUri && codeData.redirectUri !== redirectUri) {
      throw new InvalidRequestError('Invalid redirect_uri');
    }

    // Verify resource if provided (SDK passes it but doesn't validate match)
    if (resource && codeData.resource) {
      if (resource.toString() !== codeData.resource) {
        throw new InvalidRequestError('Invalid resource: ' + resource.toString() + ' != ' + codeData.resource);
      }
    }

    // Delete the authorization code (single use)
    await this.codesStore.deleteCode(authorizationCode);

    // Generate tokens
    const accessToken = randomUUID();
    const refreshToken = randomUUID();
    const now = Date.now();
    const accessTokenExpiresAt = now + this.config.accessTokenLifetime * 1000;
    const refreshTokenExpiresAt = now + this.config.refreshTokenLifetime * 1000;

    const scopes = codeData.scopes || this.config.defaultScopes;

    // Store access token
    const accessTokenData: TokenData = {
      token: accessToken,
      clientId: client.client_id,
      scopes,
      expiresAt: accessTokenExpiresAt,
      resource: codeData.resource, // Already a string
      type: 'access',
      createdAt: now,
      refreshToken,
      authorizationCode,
    };

    await this.tokensStore.createToken(accessTokenData);

    // Store refresh token
    const refreshTokenData: TokenData = {
      token: refreshToken,
      clientId: client.client_id,
      scopes,
      expiresAt: refreshTokenExpiresAt,
      resource: codeData.resource, // Already a string
      type: 'refresh',
      createdAt: now,
      authorizationCode,
    };

    await this.tokensStore.createToken(refreshTokenData);

    return {
      access_token: accessToken,
      token_type: 'bearer',
      expires_in: this.config.accessTokenLifetime,
      scope: scopes.join(' '),
      refresh_token: refreshToken,
    };
  }

  async exchangeRefreshToken(
    client: OAuthClientInformationFull,
    refreshToken: string,
    scopes?: string[],
    resource?: URL
  ): Promise<OAuthTokens> {
    // Note: Client authentication is already verified by SDK's authenticateClient middleware
    
    const tokenData = await this.tokensStore.getToken(refreshToken, 'refresh');

    if (!tokenData) {
      throw new InvalidRequestError('Invalid refresh token');
    }

    // Check expiration
    if (tokenData.expiresAt < Date.now()) {
      // Clean up expired token
      await this.tokensStore.deleteToken(refreshToken);
      throw new InvalidRequestError('Refresh token has expired');
    }

    // Verify that the refresh token belongs to this client
    // (prevents client A from using client B's refresh token)
    if (tokenData.clientId !== client.client_id) {
      throw new InvalidRequestError('Refresh token was not issued to this client');
    }

    // Verify resource if provided (SDK passes it but doesn't validate match)
    if (resource && tokenData.resource) {
      if (resource.toString() !== tokenData.resource) {
        throw new InvalidRequestError('Invalid resource');
      }
    }

    // Validate requested scopes (must be subset of original scopes)
    const requestedScopes = scopes || tokenData.scopes;
    const validScopes = requestedScopes.filter((scope) => tokenData.scopes.includes(scope));

    if (validScopes.length === 0) {
      throw new InvalidRequestError('Invalid scope');
    }

    // Generate new access token
    const newAccessToken = randomUUID();
    const now = Date.now();
    const accessTokenExpiresAt = now + this.config.accessTokenLifetime * 1000;

    // Store new access token
    const newAccessTokenData: TokenData = {
      token: newAccessToken,
      clientId: client.client_id,
      scopes: validScopes,
      expiresAt: accessTokenExpiresAt,
      resource: tokenData.resource,
      type: 'access',
      createdAt: now,
      refreshToken,
    };

    await this.tokensStore.createToken(newAccessTokenData);

    return {
      access_token: newAccessToken,
      token_type: 'bearer',
      expires_in: this.config.accessTokenLifetime,
      scope: validScopes.join(' '),
      refresh_token: refreshToken, // Return the same refresh token
    };
  }

  async verifyAccessToken(token: string): Promise<AuthInfo> {
    const tokenData = await this.tokensStore.getToken(token, 'access');

    if (!tokenData) {
      throw new Error('Invalid access token');
    }

    // Check expiration
    if (tokenData.expiresAt < Date.now()) {
      // Clean up expired token
      await this.tokensStore.deleteToken(token);
      throw new Error('Access token has expired');
    }

    return {
      token,
      clientId: tokenData.clientId,
      scopes: tokenData.scopes,
      expiresAt: Math.floor(tokenData.expiresAt / 1000),
      resource: tokenData.resource ? new URL(tokenData.resource) : undefined,
    };
  }

  async revokeToken(
    client: OAuthClientInformationFull,
    request: { token: string; token_type_hint?: string }
  ): Promise<void> {
    const tokenType = request.token_type_hint || 'access';
    const type = tokenType === 'refresh_token' ? 'refresh' : 'access';
    const tokenData = await this.tokensStore.getToken(request.token, type);

    // Only revoke if token exists and belongs to the client (per OAuth spec)
    if (tokenData && tokenData.clientId === client.client_id) {
      await this.tokensStore.deleteToken(request.token);
    }
  }

  // Cleanup expired tokens and codes
  async cleanup(): Promise<void> {
    // Remove expired authorization codes and tokens
    await Promise.all([
      this.codesStore.cleanupExpired(),
      this.tokensStore.cleanupExpired(),
    ]);

    // Also cleanup sessions (this is also done by the interval, but good to do here too)
    await this.cleanupSessions();
  }
}

