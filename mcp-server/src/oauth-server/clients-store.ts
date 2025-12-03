import Datastore from '@seald-io/nedb';
import { OAuthRegisteredClientsStore } from '@modelcontextprotocol/sdk/server/auth/clients.js';
import { OAuthClientInformationFull } from '@modelcontextprotocol/sdk/shared/auth.js';
import path from 'path';
import fs from 'fs';

export class NeDBClientsStore implements OAuthRegisteredClientsStore {
  private db: Datastore<OAuthClientInformationFull>;
  private allowedScopes: string[];

  constructor(dbPath: string, allowedScopes: string[]) {
    // Ensure database directory exists
    if (!fs.existsSync(dbPath)) {
      fs.mkdirSync(dbPath, { recursive: true });
    }

    this.allowedScopes = allowedScopes;

    const dbFile = path.join(dbPath, 'clients.db');
    this.db = new Datastore({
      filename: dbFile,
      autoload: true,
      timestampData: true,
    });

    // Ensure client_id is unique
    this.db.ensureIndex({ fieldName: 'client_id', unique: true }, (err) => {
      if (err) {
        console.error('Error ensuring index on client_id:', err);
      }
    });
  }

  // Validate and normalize scope string
  private validateAndNormalizeScope(scope?: string): string {
    // If no scope provided, use all allowed scopes as default
    if (!scope || scope.trim() === '') {
      return this.allowedScopes.join(' ');
    }

    // Parse scope string (space-separated)
    const requestedScopes = scope.trim().split(/\s+/).filter(s => s.length > 0);
    
    // Check if all requested scopes are in allowed scopes
    const invalidScopes = requestedScopes.filter(s => !this.allowedScopes.includes(s));
    if (invalidScopes.length > 0) {
      throw new Error(`Invalid scopes: "${invalidScopes.join(', ')}". Allowed scopes are: "${this.allowedScopes.join(', ')}"`);
    }

    return requestedScopes.join(' ');
  }

  async getClient(clientId: string): Promise<OAuthClientInformationFull | undefined> {
    return new Promise((resolve, reject) => {
      this.db.findOne({ client_id: clientId }, (err, doc) => {
        if (err) {
          reject(err);
        } else {
          resolve(doc || undefined);
        }
      });
    });
  }

  async registerClient(
    clientMetadata: Omit<OAuthClientInformationFull, 'client_id' | 'client_id_issued_at'>
  ): Promise<OAuthClientInformationFull> {
    // Validate and normalize scope
    // As some clients may not have a scope, we'll use the allowed scopes as default.
    const normalizedScope = this.validateAndNormalizeScope(clientMetadata.scope);

    // Generate client_id and client_secret
    const { randomUUID } = await import('node:crypto');
    const clientId = randomUUID();
    const clientSecret = randomUUID();
    const now = Math.floor(Date.now() / 1000);

    const fullClient: OAuthClientInformationFull = {
      ...clientMetadata,
      scope: normalizedScope,
      client_id: clientId,
      client_secret: clientSecret,
      client_id_issued_at: now,
      client_secret_expires_at: 0, // Never expires by default
    };

    return new Promise((resolve, reject) => {
      this.db.insert(fullClient, (err, newDoc) => {
        if (err) {
          reject(err);
        } else {
          resolve(newDoc);
        }
      });
    });
  }

  async updateClient(
    clientId: string,
    updates: Partial<OAuthClientInformationFull>
  ): Promise<OAuthClientInformationFull | undefined> {
    // If scope is being updated, validate and normalize it
    if (updates.scope !== undefined) {
      updates.scope = this.validateAndNormalizeScope(updates.scope);
    }

    return new Promise((resolve, reject) => {
      this.db.update(
        { client_id: clientId },
        { $set: updates },
        { returnUpdatedDocs: true },
        (err, numAffected, affectedDocuments) => {
          if (err) {
            reject(err);
          } else if (numAffected === 0) {
            resolve(undefined);
          } else {
            resolve(affectedDocuments as OAuthClientInformationFull);
          }
        }
      );
    });
  }

  async deleteClient(clientId: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      this.db.remove({ client_id: clientId }, {}, (err, numRemoved) => {
        if (err) {
          reject(err);
        } else {
          resolve(numRemoved > 0);
        }
      });
    });
  }

  async getAllClients(): Promise<OAuthClientInformationFull[]> {
    return new Promise((resolve, reject) => {
      this.db.find({}, (err, docs) => {
        if (err) {
          reject(err);
        } else {
          // Remove sensitive information (client_secret) from list
          const sanitizedDocs = docs.map(({ client_secret, ...rest }) => rest) as OAuthClientInformationFull[];
          resolve(sanitizedDocs);
        }
      });
    });
  }
}

