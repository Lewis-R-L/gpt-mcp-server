import express from 'express';
import { NeDBOAuthServerProvider } from './oauth-server/provider.js';

export interface AdminServerOptions {
  port?: number;
  oauthProvider: NeDBOAuthServerProvider;
}

export function createAdminServer(options: AdminServerOptions): express.Application {
  const app = express();
  const { oauthProvider } = options;

  // Middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Enable CORS for admin API
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
      return;
    }
    next();
  });

  // Health check
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'admin-server' });
  });

  // ==================== OAuth Clients Management ====================
  
  // List all clients
  app.get('/api/clients', async (req, res) => {
    try {
      const clients = await oauthProvider.clientsStore.getAllClients();
      res.json({ clients });
    } catch (error: any) {
      console.error('Error listing clients:', error);
      res.status(500).json({ error: error.message || 'Failed to list clients' });
    }
  });

  // Get client by ID
  app.get('/api/clients/:clientId', async (req, res) => {
    try {
      const { clientId } = req.params;
      const client = await oauthProvider.clientsStore.getClient(clientId);
      if (!client) {
        res.status(404).json({ error: 'Client not found' });
        return;
      }
      res.json({ client });
    } catch (error: any) {
      console.error('Error getting client:', error);
      res.status(500).json({ error: error.message || 'Failed to get client' });
    }
  });

  // Register new client
  app.post('/api/clients', async (req, res) => {
    try {
      const clientMetadata = req.body;
      const client = await oauthProvider.clientsStore.registerClient(clientMetadata);
      res.status(201).json({ client });
    } catch (error: any) {
      console.error('Error registering client:', error);
      res.status(400).json({ error: error.message || 'Failed to register client' });
    }
  });

  // Update client
  app.put('/api/clients/:clientId', async (req, res) => {
    try {
      const { clientId } = req.params;
      const updates = req.body;
      const client = await oauthProvider.clientsStore.updateClient(clientId, updates);
      if (!client) {
        res.status(404).json({ error: 'Client not found' });
        return;
      }
      res.json({ client });
    } catch (error: any) {
      console.error('Error updating client:', error);
      res.status(400).json({ error: error.message || 'Failed to update client' });
    }
  });

  // Delete client
  app.delete('/api/clients/:clientId', async (req, res) => {
    try {
      const { clientId } = req.params;
      const deleted = await oauthProvider.clientsStore.deleteClient(clientId);
      if (!deleted) {
        res.status(404).json({ error: 'Client not found' });
        return;
      }
      res.json({ success: true, message: 'Client deleted' });
    } catch (error: any) {
      console.error('Error deleting client:', error);
      res.status(500).json({ error: error.message || 'Failed to delete client' });
    }
  });

  // ==================== Users Management ====================

  // List all users (Note: This is a simple implementation, in production you might want pagination)
  app.get('/api/users', async (req, res) => {
    try {
      const users = await oauthProvider.usersStore.getAllUsers();
      // Don't return password hashes
      const sanitizedUsers = users.map(({ passwordHash, ...userInfo }) => userInfo);
      res.json({ users: sanitizedUsers });
    } catch (error: any) {
      console.error('Error listing users:', error);
      res.status(500).json({ error: error.message || 'Failed to list users' });
    }
  });

  // Get user by username
  app.get('/api/users/:username', async (req, res) => {
    try {
      const { username } = req.params;
      const user = await oauthProvider.usersStore.getUser(username);
      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }
      // Don't return password hash
      const { passwordHash, ...userInfo } = user;
      res.json({ user: userInfo });
    } catch (error: any) {
      console.error('Error getting user:', error);
      res.status(500).json({ error: error.message || 'Failed to get user' });
    }
  });

  // Create user
  app.post('/api/users', async (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        res.status(400).json({ error: 'Username and password are required' });
        return;
      }
      const user = await oauthProvider.usersStore.createUser(username, password);
      // Don't return password hash
      const { passwordHash, ...userInfo } = user;
      res.status(201).json({ user: userInfo });
    } catch (error: any) {
      console.error('Error creating user:', error);
      res.status(400).json({ error: error.message || 'Failed to create user' });
    }
  });

  // Update user password
  app.put('/api/users/:username/password', async (req, res) => {
    try {
      const { username } = req.params;
      const { password } = req.body;
      if (!password) {
        res.status(400).json({ error: 'Password is required' });
        return;
      }
      const updated = await oauthProvider.usersStore.updatePassword(username, password);
      if (!updated) {
        res.status(404).json({ error: 'User not found' });
        return;
      }
      res.json({ success: true, message: 'Password updated' });
    } catch (error: any) {
      console.error('Error updating password:', error);
      res.status(500).json({ error: error.message || 'Failed to update password' });
    }
  });

  // Delete user
  app.delete('/api/users/:username', async (req, res) => {
    try {
      const { username } = req.params;
      const deleted = await oauthProvider.usersStore.deleteUser(username);
      if (!deleted) {
        res.status(404).json({ error: 'User not found' });
        return;
      }
      res.json({ success: true, message: 'User deleted' });
    } catch (error: any) {
      console.error('Error deleting user:', error);
      res.status(500).json({ error: error.message || 'Failed to delete user' });
    }
  });

  // ==================== Pending Authorizations Management ====================

  // List all pending authorizations
  app.get('/api/pending-authorizations', async (req, res) => {
    try {
      const pendingAuths = await oauthProvider.pendingAuthorizationsStore.getAllPendingAuthorizations();
      res.json({ pendingAuthorizations: pendingAuths });
    } catch (error: any) {
      console.error('Error listing pending authorizations:', error);
      res.status(500).json({ error: error.message || 'Failed to list pending authorizations' });
    }
  });

  // Get pending authorization by sessionId
  app.get('/api/pending-authorizations/:sessionId', async (req, res) => {
    try {
      const { sessionId } = req.params;
      const pendingAuth = await oauthProvider.pendingAuthorizationsStore.getPendingAuthorization(sessionId);
      if (!pendingAuth) {
        res.status(404).json({ error: 'Pending authorization not found' });
        return;
      }
      res.json({ pendingAuthorization: pendingAuth });
    } catch (error: any) {
      console.error('Error getting pending authorization:', error);
      res.status(500).json({ error: error.message || 'Failed to get pending authorization' });
    }
  });

  // Delete pending authorization
  app.delete('/api/pending-authorizations/:sessionId', async (req, res) => {
    try {
      const { sessionId } = req.params;
      const deleted = await oauthProvider.pendingAuthorizationsStore.deletePendingAuthorization(sessionId);
      if (!deleted) {
        res.status(404).json({ error: 'Pending authorization not found' });
        return;
      }
      res.json({ success: true, message: 'Pending authorization deleted' });
    } catch (error: any) {
      console.error('Error deleting pending authorization:', error);
      res.status(500).json({ error: error.message || 'Failed to delete pending authorization' });
    }
  });

  // Cleanup expired pending authorizations
  app.post('/api/pending-authorizations/cleanup', async (req, res) => {
    try {
      const count = await oauthProvider.pendingAuthorizationsStore.cleanupExpired();
      res.json({ success: true, message: `Cleaned up ${count} expired pending authorizations`, count });
    } catch (error: any) {
      console.error('Error cleaning up pending authorizations:', error);
      res.status(500).json({ error: error.message || 'Failed to cleanup pending authorizations' });
    }
  });

  // ==================== User Sessions Management ====================

  // List all user sessions
  app.get('/api/sessions', async (req, res) => {
    try {
      const sessions = await oauthProvider.userSessionsStore.getAllSessions();
      res.json({ sessions });
    } catch (error: any) {
      console.error('Error listing sessions:', error);
      res.status(500).json({ error: error.message || 'Failed to list sessions' });
    }
  });

  // Get session by sessionId
  app.get('/api/sessions/:sessionId', async (req, res) => {
    try {
      const { sessionId } = req.params;
      const session = await oauthProvider.userSessionsStore.getSession(sessionId);
      if (!session) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }
      res.json({ session });
    } catch (error: any) {
      console.error('Error getting session:', error);
      res.status(500).json({ error: error.message || 'Failed to get session' });
    }
  });

  // Delete session
  app.delete('/api/sessions/:sessionId', async (req, res) => {
    try {
      const { sessionId } = req.params;
      const deleted = await oauthProvider.userSessionsStore.deleteSession(sessionId);
      if (!deleted) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }
      res.json({ success: true, message: 'Session deleted' });
    } catch (error: any) {
      console.error('Error deleting session:', error);
      res.status(500).json({ error: error.message || 'Failed to delete session' });
    }
  });

  // Cleanup expired sessions
  app.post('/api/sessions/cleanup', async (req, res) => {
    try {
      const sessionTimeout = Number(req.body.sessionTimeout) || 30 * 60 * 1000; // Default 30 minutes
      const count = await oauthProvider.userSessionsStore.cleanupExpired(sessionTimeout);
      res.json({ success: true, message: `Cleaned up ${count} expired sessions`, count });
    } catch (error: any) {
      console.error('Error cleaning up sessions:', error);
      res.status(500).json({ error: error.message || 'Failed to cleanup sessions' });
    }
  });

  // ==================== Tokens Management ====================

  // List all tokens
  app.get('/api/tokens', async (req, res) => {
    try {
      const { clientId, type } = req.query;
      
      if (clientId) {
        // Get tokens by client ID
        const tokens = await oauthProvider.tokensStore.getTokensByClientId(clientId as string);
        res.json({ tokens });
      } else {
        // Get all tokens
        const tokens = await oauthProvider.tokensStore.getAllTokens();
        // Filter by type if provided
        const filteredTokens = type 
          ? tokens.filter(t => t.type === type)
          : tokens;
        res.json({ tokens: filteredTokens });
      }
    } catch (error: any) {
      console.error('Error listing tokens:', error);
      res.status(500).json({ error: error.message || 'Failed to list tokens' });
    }
  });

  // Get token by token value
  app.get('/api/tokens/:token', async (req, res) => {
    try {
      const { token } = req.params;
      const { type } = req.query;
      const tokenData = await oauthProvider.tokensStore.getToken(
        token,
        type as 'access' | 'refresh' | undefined
      );
      if (!tokenData) {
        res.status(404).json({ error: 'Token not found' });
        return;
      }
      res.json({ token: tokenData });
    } catch (error: any) {
      console.error('Error getting token:', error);
      res.status(500).json({ error: error.message || 'Failed to get token' });
    }
  });

  // Delete token
  app.delete('/api/tokens/:token', async (req, res) => {
    try {
      const { token } = req.params;
      const deleted = await oauthProvider.tokensStore.deleteToken(token);
      if (!deleted) {
        res.status(404).json({ error: 'Token not found' });
        return;
      }
      res.json({ success: true, message: 'Token deleted' });
    } catch (error: any) {
      console.error('Error deleting token:', error);
      res.status(500).json({ error: error.message || 'Failed to delete token' });
    }
  });

  // Delete all tokens for a client
  app.delete('/api/tokens/client/:clientId', async (req, res) => {
    try {
      const { clientId } = req.params;
      const count = await oauthProvider.tokensStore.deleteTokensByClientId(clientId);
      res.json({ success: true, message: `Deleted ${count} token(s) for client`, count });
    } catch (error: any) {
      console.error('Error deleting tokens for client:', error);
      res.status(500).json({ error: error.message || 'Failed to delete tokens for client' });
    }
  });

  // Cleanup expired tokens
  app.post('/api/tokens/cleanup', async (req, res) => {
    try {
      const count = await oauthProvider.tokensStore.cleanupExpired();
      res.json({ success: true, message: `Cleaned up ${count} expired token(s)`, count });
    } catch (error: any) {
      console.error('Error cleaning up tokens:', error);
      res.status(500).json({ error: error.message || 'Failed to cleanup tokens' });
    }
  });

  // ==================== Authorization Codes Management ====================

  // List all authorization codes
  app.get('/api/authorization-codes', async (req, res) => {
    try {
      const { clientId } = req.query;
      
      if (clientId) {
        // Get codes by client ID
        const codes = await oauthProvider.codesStore.getCodesByClientId(clientId as string);
        res.json({ authorizationCodes: codes });
      } else {
        // Get all codes
        const codes = await oauthProvider.codesStore.getAllCodes();
        res.json({ authorizationCodes: codes });
      }
    } catch (error: any) {
      console.error('Error listing authorization codes:', error);
      res.status(500).json({ error: error.message || 'Failed to list authorization codes' });
    }
  });

  // Get authorization code by code value
  app.get('/api/authorization-codes/:code', async (req, res) => {
    try {
      const { code } = req.params;
      const codeData = await oauthProvider.codesStore.getCode(code);
      if (!codeData) {
        res.status(404).json({ error: 'Authorization code not found' });
        return;
      }
      res.json({ authorizationCode: codeData });
    } catch (error: any) {
      console.error('Error getting authorization code:', error);
      res.status(500).json({ error: error.message || 'Failed to get authorization code' });
    }
  });

  // Delete authorization code
  app.delete('/api/authorization-codes/:code', async (req, res) => {
    try {
      const { code } = req.params;
      const deleted = await oauthProvider.codesStore.deleteCode(code);
      if (!deleted) {
        res.status(404).json({ error: 'Authorization code not found' });
        return;
      }
      res.json({ success: true, message: 'Authorization code deleted' });
    } catch (error: any) {
      console.error('Error deleting authorization code:', error);
      res.status(500).json({ error: error.message || 'Failed to delete authorization code' });
    }
  });

  // Delete all authorization codes for a client
  app.delete('/api/authorization-codes/client/:clientId', async (req, res) => {
    try {
      const { clientId } = req.params;
      const count = await oauthProvider.codesStore.deleteCodesByClientId(clientId);
      res.json({ success: true, message: `Deleted ${count} authorization code(s) for client`, count });
    } catch (error: any) {
      console.error('Error deleting authorization codes for client:', error);
      res.status(500).json({ error: error.message || 'Failed to delete authorization codes for client' });
    }
  });

  // Cleanup expired authorization codes
  app.post('/api/authorization-codes/cleanup', async (req, res) => {
    try {
      const count = await oauthProvider.codesStore.cleanupExpired();
      res.json({ success: true, message: `Cleaned up ${count} expired authorization code(s)`, count });
    } catch (error: any) {
      console.error('Error cleaning up authorization codes:', error);
      res.status(500).json({ error: error.message || 'Failed to cleanup authorization codes' });
    }
  });

  // ==================== Statistics ====================

  // Get statistics
  app.get('/api/stats', async (req, res) => {
    try {
      const [clients, users, pendingAuths, sessions, tokens, codes] = await Promise.all([
        oauthProvider.clientsStore.getAllClients(),
        oauthProvider.usersStore.getAllUsers(),
        oauthProvider.pendingAuthorizationsStore.getAllPendingAuthorizations(),
        oauthProvider.userSessionsStore.getAllSessions(),
        oauthProvider.tokensStore.getAllTokens(),
        oauthProvider.codesStore.getAllCodes(),
      ]);
      
      const accessTokens = tokens.filter(t => t.type === 'access');
      const refreshTokens = tokens.filter(t => t.type === 'refresh');
      
      res.json({
        stats: {
          clients: {
            total: clients.length,
          },
          users: {
            total: users.length,
          },
          pendingAuthorizations: {
            total: pendingAuths.length,
          },
          sessions: {
            total: sessions.length,
          },
          tokens: {
            total: tokens.length,
            accessTokens: accessTokens.length,
            refreshTokens: refreshTokens.length,
          },
          authorizationCodes: {
            total: codes.length,
          },
        },
      });
    } catch (error: any) {
      console.error('Error getting statistics:', error);
      res.status(500).json({ error: error.message || 'Failed to get statistics' });
    }
  });

  // Error handling middleware
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Admin server error:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  });

  return app;
}

export async function startAdminServer(options: AdminServerOptions): Promise<void> {
  const app = createAdminServer(options);
  const port = options.port || Number(process.env.ADMIN_PORT) || 3031;

  return new Promise((resolve, reject) => {
    const server = app.listen(port, () => {
      console.log(`Admin server listening on http://localhost:${port}`);
      console.log(`Admin API endpoints:`);
      console.log(`  GET  /health`);
      console.log(`  GET  /api/clients`);
      console.log(`  GET  /api/clients/:clientId`);
      console.log(`  POST /api/clients`);
      console.log(`  PUT  /api/clients/:clientId`);
      console.log(`  DELETE /api/clients/:clientId`);
      console.log(`  GET  /api/users`);
      console.log(`  GET  /api/users/:username`);
      console.log(`  POST /api/users`);
      console.log(`  PUT  /api/users/:username/password`);
      console.log(`  DELETE /api/users/:username`);
      console.log(`  GET  /api/pending-authorizations`);
      console.log(`  GET  /api/pending-authorizations/:sessionId`);
      console.log(`  DELETE /api/pending-authorizations/:sessionId`);
      console.log(`  POST /api/pending-authorizations/cleanup`);
      console.log(`  GET  /api/sessions`);
      console.log(`  GET  /api/sessions/:sessionId`);
      console.log(`  DELETE /api/sessions/:sessionId`);
      console.log(`  POST /api/sessions/cleanup`);
      console.log(`  GET  /api/tokens`);
      console.log(`  GET  /api/tokens/:token`);
      console.log(`  DELETE /api/tokens/:token`);
      console.log(`  DELETE /api/tokens/client/:clientId`);
      console.log(`  POST /api/tokens/cleanup`);
      console.log(`  GET  /api/authorization-codes`);
      console.log(`  GET  /api/authorization-codes/:code`);
      console.log(`  DELETE /api/authorization-codes/:code`);
      console.log(`  DELETE /api/authorization-codes/client/:clientId`);
      console.log(`  POST /api/authorization-codes/cleanup`);
      console.log(`  GET  /api/stats`);
      resolve();
    });

    server.on('error', (error) => {
      console.error('Admin server error:', error);
      reject(error);
    });
  });
}

