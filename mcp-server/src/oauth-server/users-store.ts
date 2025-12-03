import Datastore from '@seald-io/nedb';
import path from 'path';
import fs from 'fs';
import { createHash, randomBytes } from 'node:crypto';

export interface User {
  username: string;
  passwordHash: string; // bcrypt or SHA256 hash
  createdAt: number;
  updatedAt: number;
}

export class NeDBUsersStore {
  private db: Datastore<User>;

  constructor(dbPath: string) {
    // Ensure database directory exists
    if (!fs.existsSync(dbPath)) {
      fs.mkdirSync(dbPath, { recursive: true });
    }

    const dbFile = path.join(dbPath, 'users.db');
    this.db = new Datastore({
      filename: dbFile,
      autoload: true,
      timestampData: true,
    });

    // Ensure username is unique
    this.db.ensureIndex({ fieldName: 'username', unique: true }, (err) => {
      if (err) {
        console.error('Error ensuring index on username:', err);
      }
    });
  }

  // Simple password hashing using SHA256 (for demo purposes)
  // In production, use bcrypt or argon2
  private hashPassword(password: string, salt?: string): { hash: string; salt: string } {
    const saltValue = salt || randomBytes(16).toString('hex');
    const hash = createHash('sha256').update(password + saltValue).digest('hex');
    return { hash, salt: saltValue };
  }

  async getUser(username: string): Promise<User | null> {
    return new Promise((resolve, reject) => {
      this.db.findOne({ username }, (err, doc) => {
        if (err) {
          reject(err);
        } else {
          resolve(doc || null);
        }
      });
    });
  }

  async verifyPassword(username: string, password: string): Promise<boolean> {
    const user = await this.getUser(username);
    if (!user) {
      return false;
    }

    // Extract salt from stored hash (format: salt:hash)
    const [salt, storedHash] = user.passwordHash.split(':');
    if (!salt || !storedHash) {
      // Legacy format without salt, try direct hash
      const { hash } = this.hashPassword(password, '');
      return hash === user.passwordHash;
    }

    const { hash } = this.hashPassword(password, salt);
    return hash === storedHash;
  }

  async createUser(username: string, password: string): Promise<User> {
    // Check if user already exists
    const existing = await this.getUser(username);
    if (existing) {
      throw new Error('User already exists');
    }

    const { hash, salt } = this.hashPassword(password);
    const now = Date.now();

    const user: User = {
      username,
      passwordHash: `${salt}:${hash}`, // Store as salt:hash
      createdAt: now,
      updatedAt: now,
    };

    return new Promise((resolve, reject) => {
      this.db.insert(user, (err, newDoc) => {
        if (err) {
          reject(err);
        } else {
          resolve(newDoc);
        }
      });
    });
  }

  async updatePassword(username: string, newPassword: string): Promise<boolean> {
    const { hash, salt } = this.hashPassword(newPassword);
    const now = Date.now();

    return new Promise((resolve, reject) => {
      this.db.update(
        { username },
        { $set: { passwordHash: `${salt}:${hash}`, updatedAt: now } },
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

  async deleteUser(username: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      this.db.remove({ username }, {}, (err, numRemoved) => {
        if (err) {
          reject(err);
        } else {
          resolve(numRemoved > 0);
        }
      });
    });
  }

  async getAllUsers(): Promise<User[]> {
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

