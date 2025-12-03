import Datastore from '@seald-io/nedb';
import path from 'path';
import fs from 'fs';

export interface UserSessionData {
  sessionId: string;
  username: string;
  createdAt: number;
}

export class NeDBUserSessionsStore {
  private db: Datastore<UserSessionData>;

  constructor(dbPath: string) {
    // Ensure database directory exists
    if (!fs.existsSync(dbPath)) {
      fs.mkdirSync(dbPath, { recursive: true });
    }

    const dbFile = path.join(dbPath, 'user_sessions.db');
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

  async getSession(sessionId: string): Promise<UserSessionData | null> {
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

  async createSession(sessionId: string, username: string): Promise<void> {
    const now = Date.now();
    const sessionData: UserSessionData = {
      sessionId,
      username,
      createdAt: now,
    };

    return new Promise((resolve, reject) => {
      this.db.insert(sessionData, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  async deleteSession(sessionId: string): Promise<boolean> {
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

  async cleanupExpired(sessionTimeout: number): Promise<number> {
    const now = Date.now();
    const expireBefore = now - sessionTimeout;

    return new Promise((resolve, reject) => {
      this.db.remove({ createdAt: { $lt: expireBefore } }, { multi: true }, (err, numRemoved) => {
        if (err) {
          reject(err);
        } else {
          resolve(numRemoved || 0);
        }
      });
    });
  }

  async getAllSessions(): Promise<UserSessionData[]> {
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

