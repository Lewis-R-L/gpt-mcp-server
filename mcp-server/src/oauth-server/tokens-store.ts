import Datastore from '@seald-io/nedb';
import path from 'path';
import fs from 'fs';

export interface TokenData {
  token: string;
  clientId: string;
  scopes: string[];
  expiresAt: number;
  resource?: string; // Store as string to avoid serialization issues
  type: 'access' | 'refresh';
  createdAt: number;
  refreshToken?: string; // For access tokens, link to refresh token
  authorizationCode?: string; // For tracking which code created this token
}

export class NeDBTokensStore {
  private db: Datastore<TokenData>;

  constructor(dbPath: string) {
    // Ensure database directory exists
    if (!fs.existsSync(dbPath)) {
      fs.mkdirSync(dbPath, { recursive: true });
    }

    const dbFile = path.join(dbPath, 'tokens.db');
    this.db = new Datastore({
      filename: dbFile,
      autoload: true,
      timestampData: true,
    });

    // Ensure token is unique
    this.db.ensureIndex({ fieldName: 'token', unique: true }, (err) => {
      if (err) {
        console.error('Error ensuring index on token:', err);
      }
    });
  }

  async getToken(token: string, type?: 'access' | 'refresh'): Promise<TokenData | null> {
    const query: any = { token };
    if (type) {
      query.type = type;
    }
    
    return new Promise((resolve, reject) => {
      this.db.findOne(query, (err, doc) => {
        if (err) {
          reject(err);
        } else {
          resolve(doc || null);
        }
      });
    });
  }

  async createToken(tokenData: TokenData): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.insert(tokenData, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  async deleteToken(token: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      this.db.remove({ token }, {}, (err, numRemoved) => {
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

  async getAllTokens(): Promise<TokenData[]> {
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

  async getTokensByClientId(clientId: string): Promise<TokenData[]> {
    return new Promise((resolve, reject) => {
      this.db.find({ clientId }, (err, docs) => {
        if (err) {
          reject(err);
        } else {
          resolve(docs);
        }
      });
    });
  }

  async deleteTokensByClientId(clientId: string): Promise<number> {
    return new Promise((resolve, reject) => {
      this.db.remove({ clientId }, { multi: true }, (err, numRemoved) => {
        if (err) {
          reject(err);
        } else {
          resolve(numRemoved || 0);
        }
      });
    });
  }
}

