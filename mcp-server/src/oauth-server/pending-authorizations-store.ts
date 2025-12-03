import Datastore from '@seald-io/nedb';
import path from 'path';
import fs from 'fs';
import { OAuthClientInformationFull } from '@modelcontextprotocol/sdk/shared/auth.js';

// Store version of AuthorizationParams with resource as string instead of URL
export interface StoredAuthorizationParams {
  redirectUri?: string;
  scopes?: string[];
  resource?: string; // Store as string to avoid serialization issues
  state?: string;
  codeChallenge?: string;
}

export interface PendingAuthorizationData {
  sessionId: string;
  client: OAuthClientInformationFull;
  params: StoredAuthorizationParams;
  validScopes: string[];
  userId?: string; // Set after login
  createdAt: number;
  expiresAt: number;
}

export class NeDBPendingAuthorizationsStore {
  private db: Datastore<PendingAuthorizationData>;

  constructor(dbPath: string) {
    // Ensure database directory exists
    if (!fs.existsSync(dbPath)) {
      fs.mkdirSync(dbPath, { recursive: true });
    }

    const dbFile = path.join(dbPath, 'pending_authorizations.db');
    this.db = new Datastore({
      filename: dbFile,
      autoload: true,
      timestampData: true,
    });

    // Ensure sessionId is unique
    this.db.ensureIndex({ fieldName: 'sessionId', unique: true }, (err) => {
      if (err) {
        console.error('Error ensuring index on sessionId:', err);
      }
    });
  }

  async getPendingAuthorization(sessionId: string): Promise<PendingAuthorizationData | null> {
    return new Promise((resolve, reject) => {
      this.db.findOne({ sessionId }, (err, doc) => {
        if (err) {
          reject(err);
        } else {
          resolve(doc || null);
        }
      });
    });
  }

  async createPendingAuthorization(data: PendingAuthorizationData): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.insert(data, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  async updatePendingAuthorization(
    sessionId: string,
    updates: Partial<PendingAuthorizationData>
  ): Promise<boolean> {
    return new Promise((resolve, reject) => {
      this.db.update(
        { sessionId },
        { $set: updates },
        {},
        (err, numAffected) => {
          if (err) {
            reject(err);
          } else {
            resolve(numAffected > 0);
          }
        }
      );
    });
  }

  async deletePendingAuthorization(sessionId: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      this.db.remove({ sessionId }, {}, (err, numRemoved) => {
        if (err) {
          reject(err);
        } else {
          resolve(numRemoved > 0);
        }
      });
    });
  }

  async cleanupExpired(): Promise<number> {
    const now = Date.now();
    return new Promise((resolve, reject) => {
      this.db.remove({ expiresAt: { $lt: now } }, { multi: true }, (err, numRemoved) => {
        if (err) {
          reject(err);
        } else {
          resolve(numRemoved || 0);
        }
      });
    });
  }

  async getAllPendingAuthorizations(): Promise<PendingAuthorizationData[]> {
    return new Promise((resolve, reject) => {
      this.db.find({}, (err, docs) => {
        if (err) {
          reject(err);
        } else {
          resolve(docs);
        }
      });
    });
  }
}

