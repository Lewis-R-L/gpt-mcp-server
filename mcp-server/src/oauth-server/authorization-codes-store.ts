import Datastore from '@seald-io/nedb';
import path from 'path';
import fs from 'fs';

export interface AuthorizationCodeData {
  code: string;
  clientId: string;
  codeChallenge: string;
  redirectUri: string;
  scopes?: string[];
  resource?: string;
  expiresAt: number;
  createdAt: number;
}

export class NeDBAuthorizationCodesStore {
  private db: Datastore<AuthorizationCodeData>;

  constructor(dbPath: string) {
    // Ensure database directory exists
    if (!fs.existsSync(dbPath)) {
      fs.mkdirSync(dbPath, { recursive: true });
    }

    const dbFile = path.join(dbPath, 'authorization_codes.db');
    this.db = new Datastore({
      filename: dbFile,
      autoload: true,
      timestampData: true,
    });

    // Ensure code is unique
    this.db.ensureIndex({ fieldName: 'code', unique: true }, (err) => {
      if (err) {
        console.error('Error ensuring index on code:', err);
      }
    });
  }

  async getCode(code: string): Promise<AuthorizationCodeData | null> {
    return new Promise((resolve, reject) => {
      this.db.findOne({ code }, (err, doc) => {
        if (err) {
          reject(err);
        } else {
          resolve(doc || null);
        }
      });
    });
  }

  async createCode(codeData: AuthorizationCodeData): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.insert(codeData, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  async deleteCode(code: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      this.db.remove({ code }, {}, (err, numRemoved) => {
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

  async getAllCodes(): Promise<AuthorizationCodeData[]> {
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

  async getCodesByClientId(clientId: string): Promise<AuthorizationCodeData[]> {
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

  async deleteCodesByClientId(clientId: string): Promise<number> {
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

